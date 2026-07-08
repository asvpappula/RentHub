import type Stripe from "stripe";
import { releaseOwnerPayout } from "@/lib/payouts";
import { releaseDepositHold } from "@/lib/deposit";
import { hasBlockingIncident, logBookingEvent } from "@/lib/booking";
import { sendTransactional } from "@/lib/email";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

interface CompleteArgs {
  rentalId: number;
  /** who triggered completion */
  actorUserId: number;
  /** the actor is the owner (payout auto-releases only on owner completion) */
  isOwner: boolean;
  /** owner-initiated deposit release in the same command */
  releaseDeposit: boolean;
}

export interface CompleteResult {
  completed: boolean;
  depositReleased: boolean;
  /** set when release was requested but a dispute/claim/incident blocks it */
  depositBlocked?: boolean;
}

/**
 * Shared, idempotent rental completion used by BOTH the complete route and the
 * owner's return-review "accept" action. Centralizes the money-critical steps
 * so they can't diverge:
 *   - compare-and-swap status confirmed|active → completed (side effects once)
 *   - bump rental_count + both parties' total_rentals, item back to available
 *   - owner-triggered completion auto-releases the HELD payout (guarded inside
 *     releaseOwnerPayout: refuses on open dispute/claim/incident, chargeback,
 *     suspended owner, not-onboarded, already-released)
 *   - optional deposit release, blocked by any open dispute/claim/incident
 *
 * No payout math here — it delegates to the Phase 2 primitives.
 */
export async function completeRental(
  admin: Admin,
  stripe: Stripe,
  args: CompleteArgs
): Promise<CompleteResult> {
  const { data: rental } = await admin
    .from("rentals")
    .select("*, item:items(id, title, rental_count)")
    .eq("id", args.rentalId)
    .single();
  if (!rental) return { completed: false, depositReleased: false };

  const fromStatus = rental.status as string;

  // CAS: only an ACTIVE (picked-up) rental can be completed, and only the
  // winner runs the side effects exactly once. A 'confirmed' rental that was
  // never picked up can NOT be completed here — that would release the payout +
  // deposit without a handoff ever happening. Pickup transitions confirmed→active.
  const { data: claimed } = await admin
    .from("rentals")
    .update({ status: "completed", return_status: "accepted" })
    .eq("id", args.rentalId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (claimed) {
    await admin
      .from("items")
      .update({
        rental_count: (rental.item?.rental_count ?? 0) + 1,
        availability_status: "available",
      })
      .eq("id", rental.item_id);

    for (const uid of [rental.renter_id, rental.owner_id]) {
      const { data: u } = await admin
        .from("users")
        .select("total_rentals")
        .eq("id", uid)
        .single();
      if (u)
        await admin
          .from("users")
          .update({ total_rentals: (u.total_rentals ?? 0) + 1 })
          .eq("id", uid);
    }

    await logBookingEvent(admin, {
      rentalId: args.rentalId,
      eventType: "completed",
      fromStatus,
      toStatus: "completed",
      actorUserId: args.actorUserId,
      actorRole: args.isOwner ? "owner" : "renter",
    });

    const otherUid =
      args.actorUserId === rental.owner_id ? rental.renter_id : rental.owner_id;
    await sendTransactional(admin, {
      userId: otherUid,
      notificationType: "rental_completed",
      subject: "Rental completed",
      body: `The rental of "${rental.item?.title ?? "your item"}" is complete. Don't forget to leave a rating!`,
      dedupeKey: `rental-${args.rentalId}-completed`,
      linkPath: `/rental/${args.rentalId}`,
      relatedRentalId: args.rentalId,
    });

    if (args.isOwner) {
      try {
        await releaseOwnerPayout(admin, stripe, args.rentalId, null);
      } catch (payoutErr) {
        console.error("[completion] payout release failed (held):", payoutErr);
      }
    }
  }

  const completed = Boolean(claimed) || fromStatus === "completed";
  // If the rental was neither active (just completed) nor already completed,
  // no money moves — never release a deposit on a non-completed rental.
  if (!completed) return { completed: false, depositReleased: false };

  // Deposit release (owner only) — race-safe + idempotent + guarded.
  if (args.releaseDeposit && args.isOwner) {
    const { data: fresh } = await admin
      .from("rentals")
      .select(
        "id, renter_id, deposit_amount, deposit_status, deposit_payment_intent_id, item:items(title)"
      )
      .eq("id", args.rentalId)
      .single();

    if (fresh && fresh.deposit_status === "held" && fresh.deposit_payment_intent_id) {
      const [{ count: disputes }, { count: claims }, blockingIncident] =
        await Promise.all([
          admin
            .from("disputes")
            .select("id", { count: "exact", head: true })
            .eq("rental_id", args.rentalId)
            .in("status", ["pending", "under_review", "appealed"]),
          admin
            .from("insurance_claims")
            .select("id", { count: "exact", head: true })
            .eq("rental_id", args.rentalId)
            .in("status", ["pending", "under_review"]),
          hasBlockingIncident(admin, args.rentalId),
        ]);
      if ((disputes ?? 0) > 0 || (claims ?? 0) > 0 || blockingIncident)
        return { completed, depositReleased: false, depositBlocked: true };

      const itemTitle = Array.isArray(fresh.item)
        ? fresh.item[0]?.title
        : (fresh.item as { title?: string } | null)?.title;
      const released = await releaseDepositHold(admin, stripe, {
        id: fresh.id,
        renter_id: fresh.renter_id,
        deposit_amount: fresh.deposit_amount,
        deposit_status: fresh.deposit_status,
        deposit_payment_intent_id: fresh.deposit_payment_intent_id,
        item: { title: itemTitle },
      });
      return { completed, depositReleased: released };
    }
  }

  return { completed, depositReleased: false };
}
