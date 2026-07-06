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
      .select("*, item:items(id, title, rental_count)")
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id && rental.renter_id !== user.id)
      throw new ApiError("Forbidden", 403);
    if (!["confirmed", "active"].includes(rental.status))
      throw new ApiError("Only confirmed or active rentals can be completed", 409);

    const { data, error } = await admin
      .from("rentals")
      .update({ status: "completed" })
      .eq("id", Number(id))
      .select()
      .single();
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

    // Bump both parties' totals.
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

    return NextResponse.json({ rental: data });
  } catch (err) {
    return handleApiError(err);
  }
}
