import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { releaseOwnerPayout } from "@/lib/payouts";
import { releaseDepositHold } from "@/lib/deposit";

/**
 * Completes a rental. When the OWNER completes with ?release=1, the deposit
 * hold is released to the renter in the SAME backend command.
 *
 * Concurrency-safe: the status transition is a compare-and-swap, so two
 * concurrent completions run the side effects exactly once. The owner payout
 * is only auto-released when the OWNER completes (never on renter-triggered
 * completion — that would pay the owner before they've confirmed the return),
 * and deposit release is race-safe + idempotent (see lib/deposit).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    const { searchParams } = new URL(request.url);
    const release = searchParams.get("release") === "1";

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(id, title, rental_count)")
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id && rental.renter_id !== user.id)
      throw new ApiError("Forbidden", 403);

    const isOwner = rental.owner_id === user.id;

    if (rental.status !== "completed" && !["confirmed", "active"].includes(rental.status))
      throw new ApiError("Only confirmed or active rentals can be completed", 409);

    // Compare-and-swap the completion: only the winner runs the side effects.
    const { data: claimed } = await admin
      .from("rentals")
      .update({ status: "completed" })
      .eq("id", Number(id))
      .in("status", ["confirmed", "active"])
      .select("id")
      .maybeSingle();

    if (claimed) {
      await Promise.all([
        admin
          .from("items")
          .update({
            rental_count: (rental.item?.rental_count ?? 0) + 1,
            availability_status: "available",
          })
          .eq("id", rental.item_id),
        createNotification(
          admin,
          rental.renter_id === user.id ? rental.owner_id : rental.renter_id,
          "rental_completed",
          "Rental completed",
          `The rental of "${rental.item?.title}" is complete. Don't forget to leave a rating!`,
          rental.id
        ),
      ]);

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

      // Auto-release the held owner payout ONLY when the owner completes — the
      // owner confirming the return is the trigger to pay them. Renter-driven
      // completion leaves the payout held (owner/admin releases later).
      // releaseOwnerPayout no-ops safely when Connect is off, the owner isn't
      // onboarded, the rental isn't completed, or a dispute/claim is open.
      if (isOwner) {
        try {
          const stripe = getStripeServer();
          await releaseOwnerPayout(admin, stripe, rental.id, null);
        } catch (payoutErr) {
          console.error("[complete] payout release failed (held):", payoutErr);
        }
      }
    }

    // Deposit release (owner only) — race-safe and idempotent.
    if (release) {
      if (!isOwner)
        throw new ApiError("Only the owner can release the deposit", 403);

      // Re-read the current deposit state (the snapshot may be stale).
      const { data: fresh } = await admin
        .from("rentals")
        .select("id, renter_id, deposit_amount, deposit_status, deposit_payment_intent_id, item:items(title)")
        .eq("id", Number(id))
        .single();

      if (fresh && fresh.deposit_status === "held" && fresh.deposit_payment_intent_id) {
        const [{ count: disputes }, { count: claims }] = await Promise.all([
          admin
            .from("disputes")
            .select("id", { count: "exact", head: true })
            .eq("rental_id", rental.id)
            .in("status", ["pending", "under_review", "appealed"]),
          admin
            .from("insurance_claims")
            .select("id", { count: "exact", head: true })
            .eq("rental_id", rental.id)
            .in("status", ["pending", "under_review"]),
        ]);
        if ((disputes ?? 0) > 0 || (claims ?? 0) > 0)
          throw new ApiError(
            "Resolve the open dispute or claim before releasing the deposit",
            409
          );

        const stripe = getStripeServer();
        const itemTitle = Array.isArray(fresh.item)
          ? fresh.item[0]?.title
          : (fresh.item as { title?: string } | null)?.title;
        await releaseDepositHold(admin, stripe, {
          id: fresh.id,
          renter_id: fresh.renter_id,
          deposit_amount: fresh.deposit_amount,
          deposit_status: fresh.deposit_status,
          deposit_payment_intent_id: fresh.deposit_payment_intent_id,
          item: { title: itemTitle },
        });
      }
    }

    const { data: result } = await admin
      .from("rentals")
      .select("*")
      .eq("id", Number(id))
      .single();
    return NextResponse.json({ rental: result });
  } catch (err) {
    return handleApiError(err);
  }
}
