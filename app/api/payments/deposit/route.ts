import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { paymentIntentSchema } from "@/lib/validation";
import { getStripeServer } from "@/lib/stripe-server";

/**
 * Authorizes the security deposit with manual capture — the card is held,
 * not charged. Completing the rental cancels the hold (refund) or captures
 * it (claim after a dispute).
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { rental_id } = await parseBody(request, paymentIntentSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*")
      .eq("id", rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.deposit_amount <= 0)
      throw new ApiError("This rental has no deposit", 400);

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.create({
      amount: rental.deposit_amount * 100,
      currency: "usd",
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      metadata: {
        rental_id: String(rental.id),
        kind: "deposit",
        renter_id: String(user.id),
      },
    });

    await admin
      .from("rentals")
      .update({ deposit_payment_intent_id: intent.id })
      .eq("id", rental.id);

    return NextResponse.json({
      clientSecret: intent.client_secret,
      amount: rental.deposit_amount * 100,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
