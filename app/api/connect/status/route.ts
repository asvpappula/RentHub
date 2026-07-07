import { NextResponse } from "next/server";
import { handleApiError, requireUser } from "@/lib/api-helpers";
import { connectEnabled } from "@/lib/payments-math";
import { toConnectStatus } from "@/lib/connect";

/** Returns the owner's payout-onboarding status (safe fields only). */
export async function GET() {
  try {
    const { user, admin } = await requireUser();
    const { data: row } = await admin
      .from("connected_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, onboarding_complete, disabled_reason, requirements_currently_due, requirements_past_due"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    const status = toConnectStatus(row, connectEnabled());
    // Never expose the raw Stripe account id to the client.
    return NextResponse.json({
      status: { ...status, stripeAccountId: undefined },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
