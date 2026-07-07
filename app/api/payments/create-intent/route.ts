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
    if (!rental.agreement_accepted_at)
      throw new ApiError("Accept the rental agreement before paying", 409);

    // Amount computed server-side — never trust the client.
    const amountCents =
      (rental.daily_rate * rental.number_of_days + rental.insurance_fee) * 100;

    const stripe = getStripeServer();

    // Attach the payment to a Stripe customer and save the card, so the
    // deposit hold can be placed afterwards without re-entering details.
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { renthub_user_id: String(user.id) },
      }));

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customer.id,
      setup_future_usage: "off_session",
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
