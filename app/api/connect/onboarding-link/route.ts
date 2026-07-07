import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { connectEnabled } from "@/lib/payments-math";

/**
 * Returns a fresh Stripe Express hosted-onboarding URL for the owner's
 * connected account. The renter/owner never receives Stripe secret keys —
 * only the single-use hosted onboarding URL.
 */
export async function POST() {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`connect:${user.id}`, 10);

    if (!connectEnabled())
      throw new ApiError("Owner payouts aren't available yet.", 503);

    const { data: acct } = await admin
      .from("connected_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!acct?.stripe_account_id)
      throw new ApiError("Create a payout account first", 400);

    const base = process.env.NEXT_PUBLIC_APP_URL;
    const stripe = getStripeServer();
    const link = await stripe.accountLinks.create({
      account: acct.stripe_account_id,
      // Stripe sends the owner back here; the page re-syncs status on return.
      refresh_url: `${base}/owner/payouts?refresh=1`,
      return_url: `${base}/owner/payouts?done=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    return handleApiError(err);
  }
}
