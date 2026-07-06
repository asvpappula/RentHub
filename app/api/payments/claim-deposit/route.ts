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

const schema = z.object({
  rental_id: z.number().int().positive(),
  reason: z.string().min(10, "Explain the claim (10+ characters)").max(2000),
});

/** Owner captures the deposit hold after damage — requires an open dispute. */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { rental_id, reason } = await parseBody(request, schema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.deposit_status !== "held")
      throw new ApiError("Deposit is not currently held", 409);
    if (!rental.deposit_payment_intent_id)
      throw new ApiError("No deposit payment on file", 409);

    const { count: disputeCount } = await admin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("rental_id", rental_id);
    if ((disputeCount ?? 0) === 0)
      throw new ApiError("File a dispute (damage/theft report) before claiming the deposit", 409);

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(
      rental.deposit_payment_intent_id
    );
    if (intent.status !== "requires_capture")
      throw new ApiError(`Deposit cannot be captured (status: ${intent.status})`, 409);

    await stripe.paymentIntents.capture(intent.id);

    await admin
      .from("rentals")
      .update({ deposit_status: "claimed", status: "disputed" })
      .eq("id", rental_id);

    await createNotification(
      admin,
      rental.renter_id,
      "deposit_claimed",
      "Deposit claimed",
      `The owner claimed the deposit for "${rental.item?.title}". Reason: ${reason}`,
      rental_id
    );

    return NextResponse.json({ success: true, deposit_status: "claimed" });
  } catch (err) {
    return handleApiError(err);
  }
}
