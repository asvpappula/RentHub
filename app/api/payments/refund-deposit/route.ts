import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { paymentIntentSchema } from "@/lib/validation";
import { getStripeServer } from "@/lib/stripe-server";

/** Owner releases the deposit hold after a damage-free return. */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { rental_id } = await parseBody(request, paymentIntentSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.deposit_status !== "held")
      throw new ApiError("Deposit is not currently held", 409);
    if (!rental.deposit_payment_intent_id)
      throw new ApiError("No deposit payment on file", 409);

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(
      rental.deposit_payment_intent_id
    );

    if (intent.status === "requires_capture") {
      // Uncaptured hold — cancelling releases the funds.
      await stripe.paymentIntents.cancel(intent.id);
    } else if (intent.status === "succeeded") {
      await stripe.refunds.create({ payment_intent: intent.id });
    } else {
      throw new ApiError(`Deposit in unexpected state: ${intent.status}`, 409);
    }

    await admin
      .from("rentals")
      .update({ deposit_status: "refunded" })
      .eq("id", rental_id);

    await createNotification(
      admin,
      rental.renter_id,
      "deposit_refunded",
      "Deposit released",
      `Your ${rental.deposit_amount ? `$${rental.deposit_amount} ` : ""}deposit for "${rental.item?.title}" has been released.`,
      rental_id
    );

    return NextResponse.json({ success: true, deposit_status: "refunded" });
  } catch (err) {
    return handleApiError(err);
  }
}
