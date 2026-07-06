import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Lazily instantiated so builds succeed without a real secret key. */
export function getStripeServer(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripe;
}
