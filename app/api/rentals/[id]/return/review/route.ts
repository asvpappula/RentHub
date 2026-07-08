import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  rateLimit,
  requireActiveUser,
} from "@/lib/api-helpers";
import { reviewReturnSchema } from "@/lib/validation";
import { getStripeServer } from "@/lib/stripe-server";
import { completeRental } from "@/lib/completion";
import { openIncident } from "@/lib/incidents";
import { logBookingEvent } from "@/lib/booking";

/**
 * Owner reviews the renter's return.
 *  - accept: completes the rental and releases the deposit (both guarded +
 *    idempotent via completeRental — refuses deposit release if a dispute/
 *    claim/incident is open).
 *  - report_issue: opens an incident, which BLOCKS payout + deposit release
 *    until an admin resolves it. No money moves.
 * Owner only; suspended users blocked.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rentalId = Number(id);
    const { user, admin } = await requireActiveUser();
    await rateLimit(`return-review:${user.id}`, 20);
    const input = await parseBody(request, reviewReturnSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", rentalId)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id)
      throw new ApiError("Only the owner can review the return", 403);
    // Must be picked up (active) first — you can't accept/complete a rental
    // whose item was never handed over.
    if (rental.status !== "active")
      throw new ApiError("The item must be picked up before the return can be reviewed", 409);

    const itemTitle = Array.isArray(rental.item)
      ? rental.item[0]?.title
      : (rental.item as { title?: string } | null)?.title;

    if (input.action === "report_issue") {
      if (!input.incident_type) throw new ApiError("Choose an issue type", 400);
      if (!input.description || input.description.trim().length < 10)
        throw new ApiError("Describe the issue (10+ characters)", 400);

      await admin
        .from("rentals")
        .update({
          return_status: "issue",
          return_reviewed_at: new Date().toISOString(),
          return_reviewed_by: user.id,
        })
        .eq("id", rentalId);

      const incident = await openIncident(admin, {
        rentalId,
        openedBy: user.id,
        againstUserId: rental.renter_id,
        type: input.incident_type,
        description: input.description.trim(),
        evidence: input.evidence ?? [],
        actorRole: "owner",
        itemTitle,
      });

      return NextResponse.json({
        ok: true,
        incident_opened: true,
        incident_id: incident.id,
      });
    }

    // accept → complete + release deposit (guarded, race-safe, idempotent).
    await admin
      .from("rentals")
      .update({
        return_reviewed_at: new Date().toISOString(),
        return_reviewed_by: user.id,
      })
      .eq("id", rentalId);

    const stripe = getStripeServer();
    const result = await completeRental(admin, stripe, {
      rentalId,
      actorUserId: user.id,
      isOwner: true,
      releaseDeposit: true,
    });

    await logBookingEvent(admin, {
      rentalId,
      eventType: "return_accepted",
      actorUserId: user.id,
      actorRole: "owner",
    });

    return NextResponse.json({
      ok: true,
      completed: result.completed,
      depositReleased: result.depositReleased,
      depositBlocked: Boolean(result.depositBlocked),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
