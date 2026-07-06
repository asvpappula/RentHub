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

/**
 * Authorizes the security deposit with manual capture — the card is held,
 * not charged. Completing the rental cancels the hold (refund) or captures
 * it (claim after a dispute).
 *
 * The card saved during the rental payment is reused off-session, so the
 * renter normally enters their details only once. If the bank requires
 * authentication, we fall back to an on-session Stripe form
 * (returns clientSecret instead of held:true).
 */
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
    if (rental.renter_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.deposit_amount <= 0)
      throw new ApiError("This rental has no deposit", 400);

    const stripe = getStripeServer();
    const amountCents = rental.deposit_amount * 100;
    const metadata = {
      rental_id: String(rental.id),
      kind: "deposit",
      renter_id: String(user.id),
    };

    // Preferred path: reuse the card saved with the rental payment.
    if (rental.payment_intent_id) {
      const rentalIntent = await stripe.paymentIntents.retrieve(
        rental.payment_intent_id
      );
      const paymentMethod =
        typeof rentalIntent.payment_method === "string"
          ? rentalIntent.payment_method
          : rentalIntent.payment_method?.id;
      const customer =
        typeof rentalIntent.customer === "string"
          ? rentalIntent.customer
          : rentalIntent.customer?.id;

      if (rentalIntent.status === "succeeded" && paymentMethod && customer) {
        try {
          const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: "usd",
            capture_method: "manual",
            customer,
            payment_method: paymentMethod,
            payment_method_types: ["card"],
            confirm: true,
            off_session: true,
            metadata,
          });

          await admin
            .from("rentals")
            .update({ deposit_payment_intent_id: intent.id })
            .eq("id", rental.id);

          if (intent.status === "requires_capture") {
            await admin
              .from("rentals")
              .update({ deposit_status: "held" })
              .eq("id", rental.id);
            await createNotification(
              admin,
              user.id,
              "deposit_held",
              "Deposit held in escrow",
              `Your $${rental.deposit_amount} deposit for "${rental.item?.title}" is on hold — it's released when the rental completes without damage.`,
              rental.id
            );
            return NextResponse.json({ held: true, amount: amountCents });
          }
          // Unexpected state — let the client confirm interactively.
          return NextResponse.json({
            clientSecret: intent.client_secret,
            amount: amountCents,
          });
        } catch {
          // Off-session declined (e.g. authentication required) —
          // fall through to the on-session form below.
        }
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    await admin
      .from("rentals")
      .update({ deposit_payment_intent_id: intent.id })
      .eq("id", rental.id);

    return NextResponse.json({
      clientSecret: intent.client_secret,
      amount: amountCents,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
