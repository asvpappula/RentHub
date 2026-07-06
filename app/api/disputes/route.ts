import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { createDisputeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const input = await parseBody(request, createDisputeSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", input.rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id && rental.owner_id !== user.id)
      throw new ApiError("Forbidden", 403);

    const { data: dispute, error } = await admin
      .from("disputes")
      .insert({
        rental_id: input.rental_id,
        dispute_type: input.dispute_type,
        reported_by: user.id,
        description: input.description,
      })
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    await admin
      .from("rentals")
      .update({ status: "disputed" })
      .eq("id", input.rental_id);

    const otherParty =
      rental.renter_id === user.id ? rental.owner_id : rental.renter_id;
    await createNotification(
      admin,
      otherParty,
      "dispute",
      `${input.dispute_type === "theft" ? "Theft" : input.dispute_type === "damage" ? "Damage" : "Issue"} reported`,
      `A dispute was opened on the rental of "${rental.item?.title}".`,
      input.rental_id
    );

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
