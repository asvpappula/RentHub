import type Stripe from "stripe";
import { createNotification } from "@/lib/api-helpers";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

interface RentalRow {
  id: number;
  renter_id: number;
  owner_id: number;
  item_id: number;
  status: string;
  start_date: string;
  end_date: string;
  deposit_amount: number;
  deposit_status: string;
  payment_intent_id: string | null;
  deposit_payment_intent_id: string | null;
  item?: { title?: string } | null;
}

export type ConfirmResult =
  | { confirmed: true }
  | { confirmed: false; reason: "deposit_auth_required"; clientSecret: string | null }
  | { confirmed: false; reason: "double_booked" }
  | { confirmed: false; reason: "payment_not_completed"; status: string };

/**
 * Server-authoritative rental confirmation.
 *
 * A rental is marked `confirmed` ONLY when both are true:
 *   1. the rental PaymentIntent has actually succeeded (verified with Stripe), and
 *   2. the required security-deposit hold exists and is valid.
 *
 * The deposit hold is placed HERE (server-side, off-session, reusing the card
 * saved with the rental payment) — never left to a follow-up client call. So
 * if the renter closes the tab right after paying, the webhook still drives
 * this and the rental cannot end up confirmed without a deposit hold.
 *
 * Idempotent: re-running on an already-confirmed rental is a no-op.
 * If the deposit can't be auto-held (bank demands authentication) the rental
 * is deliberately NOT confirmed; the caller surfaces a clientSecret so the
 * renter can authorize interactively.
 */
export async function finalizeRentalConfirmation(
  admin: Admin,
  stripe: Stripe,
  rental: RentalRow
): Promise<ConfirmResult> {
  // Idempotency: already confirmed with a held/settled deposit.
  if (
    rental.status === "confirmed" &&
    (rental.deposit_amount <= 0 || rental.deposit_status === "held")
  ) {
    return { confirmed: true };
  }

  // 1. Verify the rental payment actually succeeded.
  if (!rental.payment_intent_id)
    return { confirmed: false, reason: "payment_not_completed", status: "no_intent" };
  const rentalIntent = await stripe.paymentIntents.retrieve(rental.payment_intent_id);
  if (rentalIntent.status !== "succeeded")
    return {
      confirmed: false,
      reason: "payment_not_completed",
      status: rentalIntent.status,
    };

  // 2. Ensure a valid deposit hold (skip when the item has no deposit).
  if (rental.deposit_amount > 0 && rental.deposit_status !== "held") {
    const hold = await ensureDepositHold(admin, stripe, rental, rentalIntent);
    if (!hold.held) {
      if (hold.reason === "double_booked")
        return { confirmed: false, reason: "double_booked" };
      return {
        confirmed: false,
        reason: "deposit_auth_required",
        clientSecret: hold.clientSecret,
      };
    }
  }

  // 3. Both conditions met → confirm and take the item off the market.
  const { data: updated, error: confirmError } = await admin
    .from("rentals")
    .update({ status: "confirmed" })
    .eq("id", rental.id)
    .in("status", ["approved", "pending", "confirmed"])
    .select("id")
    .maybeSingle();
  // 23P01 = exclusion constraint: an overlapping booking won the race.
  if (confirmError?.code === "23P01")
    return { confirmed: false, reason: "double_booked" };

  await admin
    .from("items")
    .update({ availability_status: "rented" })
    .eq("id", rental.item_id);

  // Notify the owner once (only when we actually moved it to confirmed).
  if (updated) {
    await createNotification(
      admin,
      rental.owner_id,
      "rental_confirmed",
      "Booking confirmed",
      `"${rental.item?.title ?? "Your item"}" was booked and paid for.`,
      rental.id
    );
  }

  return { confirmed: true };
}

type HoldResult =
  | { held: true }
  | { held: false; reason: "auth_required"; clientSecret: string | null }
  | { held: false; reason: "double_booked"; clientSecret: null };

/** Places (or reuses) the manual-capture deposit hold, off-session. */
async function ensureDepositHold(
  admin: Admin,
  stripe: Stripe,
  rental: RentalRow,
  rentalIntent: Stripe.PaymentIntent
): Promise<HoldResult> {
  // A hold may already exist from a prior attempt.
  if (rental.deposit_payment_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(
      rental.deposit_payment_intent_id
    );
    if (existing.status === "requires_capture" || existing.status === "succeeded") {
      await markHeld(admin, rental);
      return { held: true };
    }
    if (existing.status === "requires_action" || existing.status === "requires_confirmation")
      return { held: false, reason: "auth_required", clientSecret: existing.client_secret };
  }

  const paymentMethod =
    typeof rentalIntent.payment_method === "string"
      ? rentalIntent.payment_method
      : rentalIntent.payment_method?.id;
  const customer =
    typeof rentalIntent.customer === "string"
      ? rentalIntent.customer
      : rentalIntent.customer?.id;

  const metadata = {
    rental_id: String(rental.id),
    kind: "deposit",
    renter_id: String(rental.renter_id),
  };

  if (paymentMethod && customer) {
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: rental.deposit_amount * 100,
          currency: "usd",
          capture_method: "manual",
          customer,
          payment_method: paymentMethod,
          payment_method_types: ["card"],
          confirm: true,
          off_session: true,
          metadata,
        },
        { idempotencyKey: `deposit-hold-${rental.id}` }
      );
      await admin
        .from("rentals")
        .update({ deposit_payment_intent_id: intent.id })
        .eq("id", rental.id);

      if (intent.status === "requires_capture") {
        await markHeld(admin, rental);
        return { held: true };
      }
      return { held: false, reason: "auth_required", clientSecret: intent.client_secret };
    } catch {
      // Off-session declined / authentication required — fall through to a
      // fresh on-session intent the client can complete interactively.
    }
  }

  const intent = await stripe.paymentIntents.create({
    amount: rental.deposit_amount * 100,
    currency: "usd",
    capture_method: "manual",
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  await admin
    .from("rentals")
    .update({ deposit_payment_intent_id: intent.id })
    .eq("id", rental.id);
  return { held: false, reason: "auth_required", clientSecret: intent.client_secret };
}

async function markHeld(admin: Admin, rental: RentalRow) {
  const { data: updated } = await admin
    .from("rentals")
    .update({ deposit_status: "held" })
    .eq("id", rental.id)
    .neq("deposit_status", "held")
    .select("id")
    .maybeSingle();
  if (updated) {
    await createNotification(
      admin,
      rental.renter_id,
      "deposit_held",
      "Deposit held in escrow",
      `Your $${rental.deposit_amount} deposit for "${rental.item?.title ?? "your rental"}" is on hold — it's released when the rental completes without damage.`,
      rental.id
    );
  }
}
