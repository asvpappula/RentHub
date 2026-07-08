import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  rateLimit,
  requireActiveUser,
} from "@/lib/api-helpers";
import { submitReturnSchema } from "@/lib/validation";
import { logBookingEvent } from "@/lib/booking";
import { sendTransactional } from "@/lib/email";

/**
 * Renter submits the return of an active rental with condition photos + notes.
 * This does NOT complete the rental — the OWNER reviews and accepts (or reports
 * an issue) via /return/review. Renter only; suspended users blocked.
 * Idempotent: re-submitting updates the evidence but emails the owner once.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rentalId = Number(id);
    const { user, admin } = await requireActiveUser();
    await rateLimit(`return:${user.id}`, 20);
    const input = await parseBody(request, submitReturnSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", rentalId)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id)
      throw new ApiError("Only the renter can submit the return", 403);
    if (rental.status !== "active")
      throw new ApiError(
        "You can submit a return once the rental is active (picked up)",
        409
      );
    // Once the owner has reviewed (accepted or reported an issue), the renter
    // can't silently re-open the return by re-submitting.
    if (["accepted", "issue"].includes(rental.return_status ?? ""))
      throw new ApiError("This return has already been reviewed", 409);

    const firstSubmission = rental.return_status !== "submitted";

    await admin
      .from("rentals")
      .update({
        return_status: "submitted",
        return_submitted_at: new Date().toISOString(),
        return_submitted_by: user.id,
        return_photos: input.photos ?? rental.return_photos ?? [],
        return_notes: input.notes ?? rental.return_notes ?? null,
      })
      .eq("id", rentalId)
      .eq("status", "active");

    if (firstSubmission) {
      const itemTitle = Array.isArray(rental.item)
        ? rental.item[0]?.title
        : (rental.item as { title?: string } | null)?.title;

      await logBookingEvent(admin, {
        rentalId,
        eventType: "return_submitted",
        fromStatus: "active",
        toStatus: "active",
        actorUserId: user.id,
        actorRole: "renter",
        metadata: { photos: (input.photos ?? []).length },
      });

      await sendTransactional(admin, {
        userId: rental.owner_id,
        notificationType: "return_submitted",
        subject: "Return submitted — please review",
        body: `The renter submitted the return for "${itemTitle ?? "your item"}". Review the condition photos and accept it, or report an issue.`,
        dedupeKey: `rental-${rentalId}-return-submitted`,
        linkPath: `/rental/${rentalId}`,
        relatedRentalId: rentalId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
