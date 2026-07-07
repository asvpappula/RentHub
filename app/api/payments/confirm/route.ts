import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { finalizeRentalConfirmation } from "@/lib/rental-confirmation";

const schema = z.object({ payment_intent_id: z.string().min(1) });

/**
 * Called after Stripe Elements confirms the rental payment client-side.
 * The SERVER then verifies the payment, places the deposit hold, and only
 * marks the rental confirmed if both hold — client redirect success is never
 * treated as truth. The webhook runs the same gate, so closing the tab here
 * can't leave a rental confirmed without a deposit.
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

    // A "deposit" intent confirmed by the client (SCA fallback path): just
    // re-run the gate, which will see the hold and finish confirmation.
    const result = await finalizeRentalConfirmation(admin, stripe, rental);

    if (result.confirmed) {
      return NextResponse.json({ success: true, status: "confirmed" });
    }
    if (result.reason === "deposit_auth_required") {
      return NextResponse.json(
        { success: false, needsDepositAuth: true, clientSecret: result.clientSecret },
        { status: 200 }
      );
    }
    if (result.reason === "double_booked") {
      throw new ApiError(
        "Those dates were just booked by someone else. Your payment will be refunded.",
        409
      );
    }
    throw new ApiError(
      `Payment not completed (status: ${result.status}). Please try again.`,
      409
    );
  } catch (err) {
    return handleApiError(err);
  }
}
