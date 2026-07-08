import { NextResponse } from "next/server";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { adminIncidentActionSchema } from "@/lib/validation";
import { getStripeServer } from "@/lib/stripe-server";
import { releaseDepositHold } from "@/lib/deposit";
import { logBookingEvent } from "@/lib/booking";
import { sendTransactional } from "@/lib/email";

const STATUS_MAP: Record<string, string> = {
  under_review: "under_review",
  request_evidence: "awaiting_evidence",
  resolve_owner: "resolved_owner",
  resolve_renter: "resolved_renter",
  close: "closed",
};
const RESOLVING = ["resolve_owner", "resolve_renter", "close"];

/**
 * Admin resolves a handoff incident. Backend-authoritative money outcome:
 *  - resolve_renter → release the deposit hold back to the renter (no fault).
 *  - resolve_owner  → capture the deposit to cover the owner (renter fault),
 *    idempotency-keyed so a double-click can't double-capture.
 *  - close          → no money movement.
 * Once resolved/closed the incident no longer blocks payout — the admin
 * releases the held payout from the payouts queue (shared, guarded logic).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incidentId = Number(id);
    const { user, admin } = await requireAdmin();
    const { action, reason } = await parseBody(request, adminIncidentActionSchema);

    const { data: incident } = await admin
      .from("incidents")
      .select("*, rental:rentals(*, item:items(title))")
      .eq("id", incidentId)
      .single();
    if (!incident) throw new ApiError("Incident not found", 404);

    const rental = incident.rental as
      | {
          id: number;
          renter_id: number;
          owner_id: number;
          deposit_status: string;
          deposit_amount: number;
          deposit_payment_intent_id: string | null;
          item?: { title?: string } | { title?: string }[] | null;
        }
      | null;
    const itemTitle = rental
      ? Array.isArray(rental.item)
        ? rental.item[0]?.title
        : (rental.item as { title?: string } | null)?.title
      : undefined;

    const stripe = getStripeServer();

    // Money outcome on resolution (deposit only). Guarded by deposit_status so
    // it never double-moves.
    if (rental && rental.deposit_status === "held" && rental.deposit_payment_intent_id) {
      if (action === "resolve_renter") {
        await releaseDepositHold(admin, stripe, {
          id: rental.id,
          renter_id: rental.renter_id,
          deposit_amount: rental.deposit_amount,
          deposit_status: rental.deposit_status,
          deposit_payment_intent_id: rental.deposit_payment_intent_id,
          item: { title: itemTitle },
        });
      } else if (action === "resolve_owner") {
        // Claim held → claiming in the DB FIRST (mirrors releaseDepositHold's
        // claim-first pattern) so a concurrent deposit refund — e.g. a racing
        // resolve_renter or a return-review accept — can't also fire. Capture
        // and refund must never both run on the same deposit.
        const { data: claimed } = await admin
          .from("rentals")
          .update({ deposit_status: "claiming" })
          .eq("id", rental.id)
          .eq("deposit_status", "held")
          .select("id")
          .maybeSingle();
        if (claimed) {
          try {
            const intent = await stripe.paymentIntents.retrieve(
              rental.deposit_payment_intent_id
            );
            if (intent.status === "requires_capture")
              await stripe.paymentIntents.capture(
                intent.id,
                {},
                { idempotencyKey: `deposit-capture-${rental.id}` }
              );
            await admin
              .from("rentals")
              .update({ deposit_status: "claimed" })
              .eq("id", rental.id)
              .eq("deposit_status", "claiming");
          } catch (err) {
            // Roll the claim back so it can be retried, not stuck in 'claiming'.
            await admin
              .from("rentals")
              .update({ deposit_status: "held" })
              .eq("id", rental.id)
              .eq("deposit_status", "claiming");
            throw err;
          }
        }
      }
    }

    const newStatus = STATUS_MAP[action];
    const resolving = RESOLVING.includes(action);
    await admin
      .from("incidents")
      .update({
        status: newStatus,
        resolution_notes: reason ?? incident.resolution_notes,
        resolved_by: resolving ? user.id : incident.resolved_by,
        resolved_at: resolving ? new Date().toISOString() : incident.resolved_at,
      })
      .eq("id", incidentId);

    await logBookingEvent(admin, {
      rentalId: incident.rental_id,
      eventType: `incident_${action}`,
      actorUserId: user.id,
      actorRole: "admin",
      metadata: { incident_id: incidentId },
    });
    await logAdminAction(admin, user.id, {
      actionType: `incident_${action}`,
      targetType: "incident",
      targetId: incidentId,
      reason,
      metadata: { rental_id: incident.rental_id },
    });

    if (rental) {
      for (const uid of [rental.renter_id, rental.owner_id]) {
        await sendTransactional(admin, {
          userId: uid,
          notificationType: "incident_updated",
          subject: "Update on the reported issue",
          body: `The issue on "${itemTitle ?? "your rental"}" is now: ${newStatus.replace(/_/g, " ")}.${reason ? ` Note: ${reason}` : ""}`,
          dedupeKey: `incident-${incidentId}-${action}-${uid}`,
          linkPath: `/rental/${incident.rental_id}`,
          relatedRentalId: incident.rental_id,
        });
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    return handleApiError(err);
  }
}
