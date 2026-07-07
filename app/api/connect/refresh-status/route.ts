import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { connectEnabled } from "@/lib/payments-math";
import { syncConnectedAccount, toConnectStatus } from "@/lib/connect";

/**
 * Pulls the authoritative account state from Stripe and persists it, then
 * returns the refreshed status. Called when the owner returns from hosted
 * onboarding (the account.updated webhook also keeps this current).
 */
export async function POST() {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`connect:${user.id}`, 20);

    if (!connectEnabled())
      throw new ApiError("Owner payouts aren't available yet.", 503);

    const { data: acct } = await admin
      .from("connected_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!acct?.stripe_account_id)
      throw new ApiError("No payout account", 400);

    const stripe = getStripeServer();
    const account = await stripe.accounts.retrieve(acct.stripe_account_id);
    await syncConnectedAccount(admin, user.id, account);

    const { data: row } = await admin
      .from("connected_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, onboarding_complete, disabled_reason, requirements_currently_due, requirements_past_due"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    const status = toConnectStatus(row, connectEnabled());
    return NextResponse.json({ status: { ...status, stripeAccountId: undefined } });
  } catch (err) {
    return handleApiError(err);
  }
}
