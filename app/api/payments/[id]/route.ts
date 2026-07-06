import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";

/** Get the live status of a payment intent (only parties to the rental). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(id);

    const rentalId = Number(intent.metadata.rental_id);
    if (rentalId) {
      const { data: rental } = await admin
        .from("rentals")
        .select("renter_id, owner_id")
        .eq("id", rentalId)
        .single();
      if (
        rental &&
        rental.renter_id !== user.id &&
        rental.owner_id !== user.id
      )
        throw new ApiError("Forbidden", 403);
    }

    return NextResponse.json({
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      kind: intent.metadata.kind ?? "unknown",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
