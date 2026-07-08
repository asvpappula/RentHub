import type Stripe from "stripe";
import { createNotification } from "@/lib/api-helpers";
import { computeRentalAmounts, connectEnabled } from "@/lib/payments-math";
import { ownerPayoutReady } from "@/lib/connect";
import { sendTransactional } from "@/lib/email";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

interface RentalRow {
  id: number;
  renter_id: number;
  owner_id: number;
  item_id: number;
  daily_rate: number;
  number_of_days: number;
  insurance_fee: number;
  deposit_amount: number;
  payment_intent_id: string | null;
  item?: { title?: string } | null;
}

/**
 * Records the renter payment + a HELD owner payout in the ledger, once the
 * rental payment has succeeded. Idempotent on the payment intent / rental —
 * safe to call from both the confirm route and the webhook.
 *
 * No transfer happens here. The payout sits `pending` (held) until the rental
 * completes with no open dispute/claim.
 */
export async function recordPaymentAndHeldPayout(
  admin: Admin,
  stripe: Stripe,
  rental: RentalRow
): Promise<void> {
  if (!rental.payment_intent_id) return;

  const amounts = computeRentalAmounts(rental);

  // Resolve the charge id for later transfer sourcing.
  let chargeId: string | null = null;
  try {
    const pi = await stripe.paymentIntents.retrieve(rental.payment_intent_id);
    chargeId =
      typeof pi.latest_charge === "string"
        ? pi.latest_charge
        : pi.latest_charge?.id ?? null;
  } catch {
    // Non-fatal — the charge id can be backfilled from the webhook.
  }

  // Upsert the payment row (idempotent on the payment intent).
  const { data: payment } = await admin
    .from("payments")
    .upsert(
      {
        rental_id: rental.id,
        renter_id: rental.renter_id,
        owner_id: rental.owner_id,
        item_id: rental.item_id,
        stripe_payment_intent_id: rental.payment_intent_id,
        stripe_charge_id: chargeId,
        amount_cents: amounts.rentalChargeCents,
        platform_fee_cents: amounts.platformFeeCents,
        owner_payout_cents: amounts.ownerPayoutCents,
        currency: "usd",
        status: "succeeded",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_payment_intent_id" }
    )
    .select("id")
    .maybeSingle();

  // Create the held payout row (idempotent on rental_id) if not present.
  const { data: existingPayout } = await admin
    .from("payouts")
    .select("id")
    .eq("rental_id", rental.id)
    .maybeSingle();

  if (!existingPayout) {
    const { data: acct } = await admin
      .from("connected_accounts")
      .select("id")
      .eq("user_id", rental.owner_id)
      .maybeSingle();

    await admin.from("payouts").insert({
      rental_id: rental.id,
      payment_id: payment?.id ?? null,
      owner_id: rental.owner_id,
      connected_account_id: acct?.id ?? null,
      amount_cents: amounts.ownerPayoutCents,
      currency: "usd",
      status: "pending",
      hold_reason: connectEnabled() ? "awaiting_completion" : "connect_disabled",
    });
  }
}

export type ReleaseResult =
  | { released: true; transferId: string | null; reason?: string }
  | { released: false; reason: string };

/**
 * Releases a held owner payout: creates the Stripe Transfer to the owner's
 * connected account and marks the payout transferred.
 *
 * Fully guarded and idempotent:
 *  - payout must exist and be `pending`
 *  - no open dispute or claim on the rental
 *  - owner must be payout-ready (Connect onboarding complete)
 *  - never transfers twice (idempotency key + status check)
 *
 * When Connect is disabled, funds stay on the platform; the payout is left
 * held with reason `connect_disabled` (honest — no fake transfer).
 */
export async function releaseOwnerPayout(
  admin: Admin,
  stripe: Stripe,
  rentalId: number,
  releasedBy: number | null
): Promise<ReleaseResult> {
  const { data: payout } = await admin
    .from("payouts")
    .select("*, payment:payments(stripe_charge_id, status)")
    .eq("rental_id", rentalId)
    .maybeSingle();
  if (!payout) return { released: false, reason: "no_payout_record" };
  if (payout.status === "transferred" || payout.stripe_transfer_id)
    return { released: true, transferId: payout.stripe_transfer_id, reason: "already_released" };
  if (payout.status !== "pending")
    return { released: false, reason: `payout_status_${payout.status}` };

  // Never pay out if the renter's charge was refunded.
  const paymentStatus = (payout.payment as { status?: string } | null)?.status;
  if (paymentStatus === "refunded")
    return { released: false, reason: "payment_refunded" };

  // Block on open dispute / claim / chargeback / handoff incident.
  const [{ count: disputes }, { count: claims }, { count: incidents }, { data: rental }] =
    await Promise.all([
      admin
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("rental_id", rentalId)
        .in("status", ["pending", "under_review", "appealed"]),
      admin
        .from("insurance_claims")
        .select("id", { count: "exact", head: true })
        .eq("rental_id", rentalId)
        .in("status", ["pending", "under_review"]),
      admin
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("rental_id", rentalId)
        .in("status", ["open", "under_review", "awaiting_evidence"]),
      admin.from("rentals").select("status, item:items(title)").eq("id", rentalId).single(),
    ]);
  if ((incidents ?? 0) > 0)
    return { released: false, reason: "open_incident" };
  if ((disputes ?? 0) > 0 || (claims ?? 0) > 0)
    return { released: false, reason: "open_dispute_or_claim" };
  const rentalStatus = (rental as { status?: string } | null)?.status;
  const itemTitle =
    (rental as { item?: { title?: string } | { title?: string }[] } | null)?.item &&
    (Array.isArray((rental as { item?: unknown }).item)
      ? ((rental as { item: { title?: string }[] }).item[0]?.title ?? "your rental")
      : ((rental as { item: { title?: string } }).item.title ?? "your rental"));
  // Only release once the rental has actually completed — never on a merely
  // 'confirmed' (not-yet-occurred) or 'disputed' rental.
  if (rentalStatus !== "completed")
    return { released: false, reason: `rental_not_completed_${rentalStatus}` };

  // A suspended owner must not receive payouts.
  const { data: owner } = await admin
    .from("users")
    .select("suspended")
    .eq("id", payout.owner_id)
    .maybeSingle();
  if (owner?.suspended) return { released: false, reason: "owner_suspended" };

  if (!connectEnabled())
    return { released: false, reason: "connect_disabled" };

  // Owner must be payout-ready and have a connected account.
  const ready = await ownerPayoutReady(admin, payout.owner_id);
  if (!ready) return { released: false, reason: "owner_not_onboarded" };

  // Atomically claim the pending → releasing transition so two concurrent
  // releases can't both create a transfer.
  const { data: claimed } = await admin
    .from("payouts")
    .update({ status: "releasing" })
    .eq("id", payout.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return { released: false, reason: "already_in_progress" };

  const { data: acct } = await admin
    .from("connected_accounts")
    .select("stripe_account_id")
    .eq("user_id", payout.owner_id)
    .maybeSingle();
  if (!acct?.stripe_account_id) {
    await admin.from("payouts").update({ status: "pending" }).eq("id", payout.id);
    return { released: false, reason: "no_connected_account" };
  }

  const chargeId =
    (payout.payment as { stripe_charge_id?: string } | null)?.stripe_charge_id ?? null;

  let transfer;
  try {
    // Create the transfer (idempotent — one transfer per rental).
    transfer = await stripe.transfers.create(
      {
        amount: payout.amount_cents,
        currency: payout.currency ?? "usd",
        destination: acct.stripe_account_id,
        ...(chargeId ? { source_transaction: chargeId } : {}),
        metadata: { rental_id: String(rentalId), payout_id: String(payout.id) },
      },
      { idempotencyKey: `payout-transfer-${rentalId}` }
    );
  } catch (err) {
    // Roll the claim back so it can be retried, not stuck in 'releasing'.
    await admin
      .from("payouts")
      .update({ status: "pending" })
      .eq("id", payout.id)
      .eq("status", "releasing");
    throw err;
  }

  await admin
    .from("payouts")
    .update({
      stripe_transfer_id: transfer.id,
      status: "transferred",
      hold_reason: null,
      released_by: releasedBy,
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id);

  await sendTransactional(admin, {
    userId: payout.owner_id,
    notificationType: "rental_completed",
    subject: "Payout sent",
    body: `Your $${(payout.amount_cents / 100).toFixed(2)} payout for "${itemTitle}" is on its way to your bank.`,
    dedupeKey: `payout-${rentalId}-sent`,
    linkPath: `/owner/dashboard`,
    relatedRentalId: rentalId,
  });

  return { released: true, transferId: transfer.id };
}

/**
 * Blocks a still-held payout, OR claws back an already-transferred one.
 *
 * A chargeback/refund can arrive AFTER the owner payout already transferred.
 * If we only blocked `pending` payouts, the platform would eat the loss. So
 * when the payout is already `transferred`, we issue a Stripe transfer
 * REVERSAL to reclaim the funds from the owner's connected account.
 * Idempotent via status CAS + reversal idempotency key.
 */
export async function reverseOrBlockPayout(
  admin: Admin,
  stripe: Stripe,
  rentalId: number,
  reason: string
): Promise<void> {
  const { data: payout } = await admin
    .from("payouts")
    .select("id, status, stripe_transfer_id")
    .eq("rental_id", rentalId)
    .maybeSingle();
  if (!payout) return;

  if (payout.status === "pending" || payout.status === "releasing") {
    await admin
      .from("payouts")
      .update({ status: "blocked", hold_reason: reason, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId)
      .in("status", ["pending", "releasing"]);
    return;
  }

  if (payout.status === "transferred" && payout.stripe_transfer_id) {
    // Claim the transferred → reversing transition, then reverse.
    const { data: claimed } = await admin
      .from("payouts")
      .update({ status: "reversing", hold_reason: reason })
      .eq("id", payout.id)
      .eq("status", "transferred")
      .select("id")
      .maybeSingle();
    if (!claimed) return; // already being reversed
    try {
      await stripe.transfers.createReversal(
        payout.stripe_transfer_id,
        { metadata: { rental_id: String(rentalId), reason } },
        { idempotencyKey: `payout-reversal-${rentalId}` }
      );
      await admin
        .from("payouts")
        .update({ status: "reversed", updated_at: new Date().toISOString() })
        .eq("id", payout.id);
    } catch (err) {
      await admin
        .from("payouts")
        .update({ status: "transferred" })
        .eq("id", payout.id)
        .eq("status", "reversing");
      throw err;
    }
  }
}
export async function blockPayout(
  admin: Admin,
  rentalId: number,
  reason: string
): Promise<void> {
  await admin
    .from("payouts")
    .update({ status: "blocked", hold_reason: reason, updated_at: new Date().toISOString() })
    .eq("rental_id", rentalId)
    .in("status", ["pending"]);
}
