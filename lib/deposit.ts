import type Stripe from "stripe";
import { createNotification } from "@/lib/api-helpers";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

interface RentalRow {
  id: number;
  renter_id: number;
  deposit_amount: number;
  deposit_status: string;
  deposit_payment_intent_id: string | null;
  item?: { title?: string } | null;
}

/**
 * Releases the renter's deposit hold back to them — race-safe and idempotent.
 *
 * The double-refund bug: two concurrent completions both read deposit_status
 * ='held', both call Stripe refund, renter refunded twice. Fixed here by
 * atomically CLAIMING the transition (held → refunding) in the database first;
 * only the winner performs the Stripe operation, and the Stripe call itself
 * carries an idempotency key as a second line of defence.
 */
export async function releaseDepositHold(
  admin: Admin,
  stripe: Stripe,
  rental: RentalRow
): Promise<boolean> {
  if (rental.deposit_amount <= 0 || !rental.deposit_payment_intent_id) return false;

  // Atomically claim the held → refunding transition. Loser gets no row.
  const { data: claimed } = await admin
    .from("rentals")
    .update({ deposit_status: "refunding" })
    .eq("id", rental.id)
    .eq("deposit_status", "held")
    .select("id")
    .maybeSingle();
  if (!claimed) return false; // another request already handled it

  try {
    const intent = await stripe.paymentIntents.retrieve(
      rental.deposit_payment_intent_id
    );
    if (intent.status === "requires_capture") {
      // Cancelling an uncaptured hold is naturally idempotent.
      await stripe.paymentIntents.cancel(intent.id);
    } else if (intent.status === "succeeded") {
      await stripe.refunds.create(
        { payment_intent: intent.id },
        { idempotencyKey: `deposit-refund-${rental.id}` }
      );
    }
    await admin
      .from("rentals")
      .update({ deposit_status: "refunded" })
      .eq("id", rental.id);

    await createNotification(
      admin,
      rental.renter_id,
      "deposit_refunded",
      "Deposit released",
      `Your $${rental.deposit_amount} deposit for "${rental.item?.title ?? "your rental"}" has been released.`,
      rental.id
    );
    return true;
  } catch (err) {
    // Roll the claim back so it can be retried rather than getting stuck.
    await admin
      .from("rentals")
      .update({ deposit_status: "held" })
      .eq("id", rental.id)
      .eq("deposit_status", "refunding");
    throw err;
  }
}
