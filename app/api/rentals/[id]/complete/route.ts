import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireActiveUser } from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { completeRental } from "@/lib/completion";

/**
 * Completes a rental. When the OWNER completes with ?release=1, the deposit
 * hold is released to the renter in the SAME backend command.
 *
 * All money-critical logic lives in lib/completion.completeRental (shared with
 * the owner return-review "accept" action): the status transition is a
 * compare-and-swap so concurrent completions run side effects exactly once, the
 * owner payout auto-releases only on OWNER completion, and deposit release is
 * race-safe + idempotent and refuses while a dispute/claim/incident is open.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rentalId = Number(id);
    const { user, admin } = await requireActiveUser();
    const { searchParams } = new URL(request.url);
    const release = searchParams.get("release") === "1";

    const { data: rental } = await admin
      .from("rentals")
      .select("id, owner_id, renter_id, status")
      .eq("id", rentalId)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id && rental.renter_id !== user.id)
      throw new ApiError("Forbidden", 403);
    const isOwner = rental.owner_id === user.id;
    // Only an active (picked-up) rental — or an already-completed one for an
    // idempotent deposit release — can be completed here.
    if (!["completed", "active"].includes(rental.status))
      throw new ApiError("Only an active (picked-up) rental can be completed", 409);
    if (release && !isOwner)
      throw new ApiError("Only the owner can release the deposit", 403);

    const stripe = getStripeServer();
    const result = await completeRental(admin, stripe, {
      rentalId,
      actorUserId: user.id,
      isOwner,
      releaseDeposit: release,
    });
    if (result.depositBlocked)
      throw new ApiError(
        "Resolve the open dispute, claim, or incident before releasing the deposit",
        409
      );

    const { data: fresh } = await admin
      .from("rentals")
      .select("*")
      .eq("id", rentalId)
      .single();
    return NextResponse.json({ rental: fresh });
  } catch (err) {
    return handleApiError(err);
  }
}
