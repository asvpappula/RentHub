import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { paymentIntentSchema } from "@/lib/validation";
import { getStripeServer } from "@/lib/stripe-server";
import { releaseDepositHold } from "@/lib/deposit";

/** Owner releases the deposit hold after a damage-free return. */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { rental_id } = await parseBody(request, paymentIntentSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("id, owner_id, renter_id, deposit_amount, deposit_status, deposit_payment_intent_id, item:items(title)")
      .eq("id", rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.deposit_status !== "held")
      throw new ApiError("Deposit is not currently held", 409);
    if (!rental.deposit_payment_intent_id)
      throw new ApiError("No deposit payment on file", 409);

    const stripe = getStripeServer();
    const itemTitle = Array.isArray(rental.item)
      ? rental.item[0]?.title
      : (rental.item as { title?: string } | null)?.title;

    // Race-safe + idempotent: claims the transition, refunds once.
    const done = await releaseDepositHold(admin, stripe, {
      id: rental.id,
      renter_id: rental.renter_id,
      deposit_amount: rental.deposit_amount,
      deposit_status: rental.deposit_status,
      deposit_payment_intent_id: rental.deposit_payment_intent_id,
      item: { title: itemTitle },
    });

    return NextResponse.json({ success: done, deposit_status: "refunded" });
  } catch (err) {
    return handleApiError(err);
  }
}
