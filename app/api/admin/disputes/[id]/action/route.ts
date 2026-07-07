import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { getStripeServer } from "@/lib/stripe-server";
import { releaseDepositHold } from "@/lib/deposit";
import { sendTransactional } from "@/lib/email";

const schema = z.object({
  action: z.enum([
    "under_review",
    "request_evidence",
    "resolve_renter", // renter favour → deposit released to renter
    "resolve_owner", // owner favour → deposit captured for owner
    "close", // resolved with no money movement
  ]),
  reason: z.string().max(2000).optional(),
});

/**
 * Admin dispute resolution. Backend-authoritative: the money outcome is
 * computed here (release vs capture the deposit hold), never trusted from the
 * client. Every action writes admin_actions and notifies + emails the parties.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireAdmin();
    const { action, reason } = await parseBody(request, schema);

    const { data: dispute } = await admin
      .from("disputes")
      .select("*, rental:rentals(*, item:items(id, title))")
      .eq("id", Number(id))
      .single();
    if (!dispute) throw new ApiError("Dispute not found", 404);
    const rental = dispute.rental;
    if (!rental) throw new ApiError("Rental not found", 404);
    const itemTitle = rental.item?.title ?? "your rental";

    const stripe = getStripeServer();

    if (action === "under_review") {
      await admin.from("disputes").update({ status: "under_review" }).eq("id", Number(id));
    } else if (action === "request_evidence") {
      await admin.from("disputes").update({ status: "under_review" }).eq("id", Number(id));
      await sendTransactional(admin, {
        userId: dispute.reported_by,
        notificationType: "dispute",
        subject: "More evidence needed for your report",
        body: `Our team is reviewing the dispute on "${itemTitle}" and needs more evidence. Please add photos or details from the rental page.`,
        dedupeKey: `dispute-${id}-evidence-${Date.now()}`,
        linkPath: `/disputes/${id}`,
        relatedRentalId: rental.id,
      });
    } else if (action === "resolve_renter" || action === "resolve_owner") {
      if (dispute.status === "resolved")
        throw new ApiError("Dispute already resolved", 409);

      // Apply the deposit outcome.
      if (rental.deposit_status === "held" && rental.deposit_payment_intent_id) {
        if (action === "resolve_renter") {
          // Renter favour → release the hold back to the renter (race-safe).
          await releaseDepositHold(admin, stripe, {
            id: rental.id,
            renter_id: rental.renter_id,
            deposit_amount: rental.deposit_amount,
            deposit_status: rental.deposit_status,
            deposit_payment_intent_id: rental.deposit_payment_intent_id,
            item: { title: itemTitle },
          });
        } else {
          // Owner favour → capture the deposit hold. Idempotency-keyed so a
          // double-click can't make the second capture throw "already captured".
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
            .eq("deposit_status", "held");
        }
      }

      await admin
        .from("rentals")
        .update({ status: "completed" })
        .eq("id", rental.id)
        .neq("status", "completed");
      await admin
        .from("disputes")
        .update({
          status: "resolved",
          resolution_notes: reason ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", Number(id));

      // Notify + email both parties.
      const outcome =
        action === "resolve_renter"
          ? "resolved in the renter's favour — the deposit was released to the renter"
          : "resolved in the owner's favour — the deposit was claimed to cover the reported issue";
      for (const uid of [rental.renter_id, rental.owner_id]) {
        await sendTransactional(admin, {
          userId: uid,
          notificationType: action === "resolve_renter" ? "deposit_refunded" : "deposit_claimed",
          subject: "Your dispute has been resolved",
          body: `The dispute on "${itemTitle}" was ${outcome}.${reason ? ` Note: ${reason}` : ""}`,
          dedupeKey: `dispute-${id}-resolved-${uid}`,
          linkPath: `/disputes/${id}`,
          relatedRentalId: rental.id,
        });
      }
    } else if (action === "close") {
      await admin
        .from("disputes")
        .update({
          status: "resolved",
          resolution_notes: reason ?? "Closed without action.",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", Number(id));
    }

    await logAdminAction(admin, user.id, {
      actionType: `dispute_${action}`,
      targetType: "dispute",
      targetId: id,
      reason,
      metadata: { rental_id: rental.id },
    });

    const { data: fresh } = await admin
      .from("disputes")
      .select("*")
      .eq("id", Number(id))
      .single();
    return NextResponse.json({ dispute: fresh });
  } catch (err) {
    return handleApiError(err);
  }
}
