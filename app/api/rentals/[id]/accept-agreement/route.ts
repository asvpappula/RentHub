import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

/** Renter digitally accepts the rental agreement (required before payment). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: rental } = await admin
      .from("rentals")
      .select("id, renter_id, agreement_accepted_at")
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id)
      throw new ApiError("Only the renter accepts the agreement", 403);

    if (rental.agreement_accepted_at)
      return NextResponse.json({ accepted_at: rental.agreement_accepted_at });

    const acceptedAt = new Date().toISOString();
    const { error } = await admin
      .from("rentals")
      .update({ agreement_accepted_at: acceptedAt })
      .eq("id", Number(id));
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ accepted_at: acceptedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
