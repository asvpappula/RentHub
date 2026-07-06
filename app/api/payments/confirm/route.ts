import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";

const schema = z.object({ payment_intent_id: z.string().min(1) });

/**
 * Called after Stripe Elements confirms the payment client-side.
 * Verifies the intent status with Stripe and marks the rental confirmed.
 * (The webhook does the same — this gives immediate UX feedback.)
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { payment_intent_id } = await parseBody(request, schema);

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

    const rentalId = Number(intent.metadata.rental_id);
    if (!rentalId) throw new ApiError("Unknown payment", 400);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(id, title)")
      .eq("id", rentalId)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id) throw new ApiError("Forbidden", 403);

    if (intent.metadata.kind === "deposit") {
      if (intent.status !== "requires_capture" && intent.status !== "succeeded")
        throw new ApiError(`Deposit not authorized (status: ${intent.status})`, 409);
      await admin
        .from("rentals")
        .update({ deposit_status: "held" })
        .eq("id", rentalId);
      return NextResponse.json({ success: true, deposit_status: "held" });
    }

    if (intent.status !== "succeeded")
      throw new ApiError(`Payment not completed (status: ${intent.status})`, 409);

    await admin
      .from("rentals")
      .update({ status: "confirmed" })
      .eq("id", rentalId);
    await admin
      .from("items")
      .update({ availability_status: "rented" })
      .eq("id", rental.item_id);

    await createNotification(
      admin,
      rental.owner_id,
      "rental_confirmed",
      "Booking confirmed",
      `"${rental.item?.title}" was booked and paid for.`,
      rentalId
    );

    return NextResponse.json({ success: true, status: "confirmed" });
  } catch (err) {
    return handleApiError(err);
  }
}
