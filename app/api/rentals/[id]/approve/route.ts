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
      throw new ApiError("Only pending requests can be approved", 409);

    const { data, error } = await admin
      .from("rentals")
      .update({ status: "approved" })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    await createNotification(
      admin,
      rental.renter_id,
      "rental_approved",
      "Rental request approved",
      `Your request for "${rental.item?.title}" was approved — complete checkout to confirm.`,
      rental.id
    );

    return NextResponse.json({ rental: data });
  } catch (err) {
    return handleApiError(err);
  }
}
