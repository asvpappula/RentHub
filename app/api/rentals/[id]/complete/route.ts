import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";

/**
 * Completes a rental. When the OWNER completes with ?release=1, the deposit
 * hold is released to the renter in the SAME backend command — the two steps
 * are no longer separate client calls that can leave inconsistent state.
 *
 * Guards: actor must be a party; rental must be confirmed/active; deposit is
 * only released when it's currently held and no dispute/claim is open.
 * Idempotent: completing an already-completed rental just returns it.
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

    // Idempotent completion.
    if (rental.status === "completed") {
      if (!release) return NextResponse.json({ rental });
    } else if (!["confirmed", "active"].includes(rental.status)) {
      throw new ApiError("Only confirmed or active rentals can be completed", 409);
    }

    const wasAlreadyCompleted = rental.status === "completed";

    if (!wasAlreadyCompleted) {
      const { error } = await admin
        .from("rentals")
        .update({ status: "completed" })
        .eq("id", Number(id));
      if (error) throw new ApiError(error.message, 400);

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
    }

    // Deposit release, atomically with completion (owner only).
    if (release) {
      if (rental.owner_id !== user.id)
        throw new ApiError("Only the owner can release the deposit", 403);

      if (rental.deposit_status === "held" && rental.deposit_payment_intent_id) {
        // Don't release while a dispute or claim is open.
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
            .eq("status", "pending"),
        ]);
        if ((disputes ?? 0) > 0 || (claims ?? 0) > 0)
          throw new ApiError(
            "Resolve the open dispute or claim before releasing the deposit",
            409
          );

        const stripe = getStripeServer();
        const intent = await stripe.paymentIntents.retrieve(
          rental.deposit_payment_intent_id
        );
        if (intent.status === "requires_capture")
          await stripe.paymentIntents.cancel(intent.id);
        else if (intent.status === "succeeded")
          await stripe.refunds.create({ payment_intent: intent.id });

        await admin
          .from("rentals")
          .update({ deposit_status: "refunded" })
          .eq("id", rental.id);

        await createNotification(
          admin,
          rental.renter_id,
          "deposit_refunded",
          "Deposit released",
          `Your $${rental.deposit_amount} deposit for "${rental.item?.title}" has been released.`,
          rental.id
        );
      }
    }

    const { data: fresh } = await admin
      .from("rentals")
      .select("*")
      .eq("id", Number(id))
      .single();
    return NextResponse.json({ rental: fresh });
  } catch (err) {
    return handleApiError(err);
  }
}
