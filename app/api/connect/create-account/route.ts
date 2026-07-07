import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { connectEnabled } from "@/lib/payments-math";
import { syncConnectedAccount } from "@/lib/connect";

/**
 * Creates a Stripe Express connected account for the authenticated owner
 * (one per owner). The Stripe account id is stored server-side only and is
 * never returned to the browser.
 */
export async function POST() {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`connect:${user.id}`, 10);

    if (!connectEnabled())
      throw new ApiError("Owner payouts aren't available yet.", 503);

    // One account per owner.
    const { data: existing } = await admin
      .from("connected_accounts")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, existing: true });

    const stripe = getStripeServer();
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      metadata: { renthub_user_id: String(user.id) },
    });

    await admin.from("connected_accounts").insert({
      user_id: user.id,
      stripe_account_id: account.id,
      account_type: "express",
    });
    await syncConnectedAccount(admin, user.id, account);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
