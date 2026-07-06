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
  decision: z.enum(["release", "claim"]),
  notes: z.string().max(2000).optional(),
});

/**
 * Owner resolves the dispute:
 * - release: the renter gets the deposit back (hold cancelled/refunded)
 * - claim: the deposit is captured to cover damage/theft
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    const { decision, notes } = await parseBody(request, schema);

    const { data: dispute } = await admin
      .from("disputes")
      .select("*, rental:rentals(*, item:items(title))")
      .eq("id", Number(id))
      .single();
    if (!dispute) throw new ApiError("Dispute not found", 404);

    const rental = dispute.rental;
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id)
      throw new ApiError("Only the item owner can resolve a dispute", 403);
    if (["resolved"].includes(dispute.status))
      throw new ApiError("This dispute is already resolved", 409);

    // Apply the deposit outcome (when a hold is in place).
    if (rental.deposit_status === "held" && rental.deposit_payment_intent_id) {
      const stripe = getStripeServer();
      const intent = await stripe.paymentIntents.retrieve(
        rental.deposit_payment_intent_id
      );
      if (decision === "release") {
        if (intent.status === "requires_capture")
          await stripe.paymentIntents.cancel(intent.id);
        else if (intent.status === "succeeded")
          await stripe.refunds.create({ payment_intent: intent.id });
        await admin
          .from("rentals")
          .update({ deposit_status: "refunded", status: "completed" })
          .eq("id", rental.id);
      } else {
        if (intent.status !== "requires_capture")
          throw new ApiError(
            `Deposit cannot be captured (status: ${intent.status})`,
            409
          );
        await stripe.paymentIntents.capture(intent.id);
        await admin
          .from("rentals")
          .update({ deposit_status: "claimed", status: "completed" })
          .eq("id", rental.id);
      }
    } else if (decision === "claim") {
      throw new ApiError("No deposit hold to claim on this rental", 409);
    } else {
      await admin
        .from("rentals")
        .update({ status: "completed" })
        .eq("id", rental.id);
    }

    const { data, error } = await admin
      .from("disputes")
      .update({
        status: "resolved",
        resolution_notes: notes ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    await createNotification(
      admin,
      rental.renter_id,
      decision === "release" ? "deposit_refunded" : "deposit_claimed",
      decision === "release"
        ? "Dispute resolved — deposit released"
        : "Dispute resolved — deposit claimed",
      `The dispute on "${rental.item?.title}" was resolved${notes ? `: ${notes}` : "."}`,
      rental.id
    );

    return NextResponse.json({ dispute: data });
  } catch (err) {
    return handleApiError(err);
  }
}
