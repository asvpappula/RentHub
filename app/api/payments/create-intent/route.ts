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
 * Creates the rental payment intent (rate x days + insurance).
 * The deposit is authorized separately via /api/payments/deposit.
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
    if (rental.status !== "approved")
      throw new ApiError("Rental must be approved by the owner first", 409);

    // Amount computed server-side — never trust the client.
    const amountCents =
      (rental.daily_rate * rental.number_of_days + rental.insurance_fee) * 100;

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        rental_id: String(rental.id),
        kind: "rental_payment",
        renter_id: String(user.id),
      },
    });

    await admin
      .from("rentals")
      .update({ payment_intent_id: intent.id })
      .eq("id", rental.id);

    return NextResponse.json({
      clientSecret: intent.client_secret,
      amount: amountCents,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
