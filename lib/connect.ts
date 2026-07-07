import type Stripe from "stripe";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export interface ConnectStatus {
  hasAccount: boolean;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  disabledReason: string | null;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
  /** Derived UI state. */
  state:
    | "unavailable" // Connect not enabled by ops
    | "not_started"
    | "onboarding_started"
    | "pending_verification"
    | "enabled"
    | "restricted";
  /** Can this owner actually receive paid bookings right now? */
  payoutReady: boolean;
}

/**
 * Persists the authoritative Stripe account state into connected_accounts.
 * Never trusts client input — the truth is always the Stripe Account object.
 */
export async function syncConnectedAccount(
  admin: Admin,
  userId: number,
  account: Stripe.Account
): Promise<void> {
  const req = account.requirements;
  const onboardingComplete =
    !!account.details_submitted &&
    !!account.charges_enabled &&
    !!account.payouts_enabled;

  await admin
    .from("connected_accounts")
    .update({
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
      requirements_currently_due: req?.currently_due ?? [],
      requirements_eventually_due: req?.eventually_due ?? [],
      requirements_past_due: req?.past_due ?? [],
      disabled_reason: req?.disabled_reason ?? null,
      onboarding_complete: onboardingComplete,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);
}

interface ConnectedAccountRow {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  disabled_reason: string | null;
  requirements_currently_due: string[] | null;
  requirements_past_due: string[] | null;
}

/** Maps a stored connected_accounts row to the UI-facing status. */
export function toConnectStatus(
  row: ConnectedAccountRow | null,
  connectAvailable: boolean
): ConnectStatus {
  if (!connectAvailable) {
    return {
      hasAccount: !!row,
      stripeAccountId: row?.stripe_account_id ?? null,
      chargesEnabled: !!row?.charges_enabled,
      payoutsEnabled: !!row?.payouts_enabled,
      detailsSubmitted: !!row?.details_submitted,
      onboardingComplete: !!row?.onboarding_complete,
      disabledReason: row?.disabled_reason ?? null,
      requirementsCurrentlyDue: row?.requirements_currently_due ?? [],
      requirementsPastDue: row?.requirements_past_due ?? [],
      state: "unavailable",
      payoutReady: false,
    };
  }

  let state: ConnectStatus["state"] = "not_started";
  if (row) {
    if (row.onboarding_complete) state = "enabled";
    else if (row.disabled_reason || (row.requirements_past_due?.length ?? 0) > 0)
      state = "restricted";
    else if (row.details_submitted) state = "pending_verification";
    else state = "onboarding_started";
  }

  const payoutReady =
    !!row &&
    !!row.details_submitted &&
    !!row.charges_enabled &&
    !!row.payouts_enabled &&
    !row.disabled_reason;

  return {
    hasAccount: !!row,
    stripeAccountId: row?.stripe_account_id ?? null,
    chargesEnabled: !!row?.charges_enabled,
    payoutsEnabled: !!row?.payouts_enabled,
    detailsSubmitted: !!row?.details_submitted,
    onboardingComplete: !!row?.onboarding_complete,
    disabledReason: row?.disabled_reason ?? null,
    requirementsCurrentlyDue: row?.requirements_currently_due ?? [],
    requirementsPastDue: row?.requirements_past_due ?? [],
    state,
    payoutReady,
  };
}

/** Server-side payout-readiness check for an owner (blocks paid bookings). */
export async function ownerPayoutReady(
  admin: Admin,
  ownerId: number
): Promise<boolean> {
  const { data } = await admin
    .from("connected_accounts")
    .select(
      "details_submitted, charges_enabled, payouts_enabled, disabled_reason"
    )
    .eq("user_id", ownerId)
    .maybeSingle();
  return (
    !!data &&
    !!data.details_submitted &&
    !!data.charges_enabled &&
    !!data.payouts_enabled &&
    !data.disabled_reason
  );
}
