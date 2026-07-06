import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  requireUser,
} from "@/lib/api-helpers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

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

    await createNotification(
      admin,
      rental.renter_id,
      "rental_rejected",
      "Rental request declined",
      `Your request for "${rental.item?.title}" was declined by the owner.`,
      rental.id
    );

    return NextResponse.json({ rental: data });
  } catch (err) {
    return handleApiError(err);
  }
}
