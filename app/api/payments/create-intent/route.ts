import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { paymentIntentSchema } from "@/lib/validation";
import { getStripeServer } from "@/lib/stripe-server";
import { connectEnabled } from "@/lib/payments-math";
import { ownerPayoutReady } from "@/lib/connect";

/**
 * Creates the rental payment intent (rate x days + insurance). The deposit
 * hold is placed server-side during confirmation (see lib/rental-confirmation).
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`checkout:${user.id}`, 20);
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

    // Don't collect renter money we can't pay out: the owner must have
    // completed payout onboarding (only enforced once Connect is live).
    if (connectEnabled() && !(await ownerPayoutReady(admin, rental.owner_id)))
      throw new ApiError(
        "This owner hasn't finished setting up payouts yet. Please try again later.",
        409
      );

    // Re-check availability at payment time — another booking for overlapping
    // dates may have been confirmed since this request was approved.
    const { count: overlapping } = await admin
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("item_id", rental.item_id)
      .neq("id", rental.id)
      .in("status", ["confirmed", "active"])
      .lte("start_date", rental.end_date)
      .gte("end_date", rental.start_date);
    if ((overlapping ?? 0) > 0)
      throw new ApiError(
        "Those dates are no longer available — please pick new dates.",
        409
      );

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

    const intent = await stripe.paymentIntents.create(
      {
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
      },
      { idempotencyKey: `rental-payment-${rental.id}` }
    );

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
