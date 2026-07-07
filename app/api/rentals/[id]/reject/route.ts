import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  requireUser,
} from "@/lib/api-helpers";
import { sendTransactional } from "@/lib/email";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    // Optional rejection reason, shared with the renter.
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id) throw new ApiError("Forbidden", 403);
    if (rental.status !== "pending")
      throw new ApiError("Only pending requests can be rejected", 409);

    const { data, error } = await admin
      .from("rentals")
      .update({ status: "rejected" })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    await sendTransactional(admin, {
      userId: rental.renter_id,
      notificationType: "rental_rejected",
      subject: "Rental request declined",
      body: `Your request for "${rental.item?.title}" was declined by the owner.${reason ? ` Reason: ${reason}` : ""}`,
      dedupeKey: `rental-${rental.id}-rejected`,
      linkPath: `/browse`,
      relatedRentalId: rental.id,
    });

    return NextResponse.json({ rental: data });
  } catch (err) {
    return handleApiError(err);
  }
}
