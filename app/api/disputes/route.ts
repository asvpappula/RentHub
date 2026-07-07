import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { createDisputeSchema } from "@/lib/validation";

const DISPUTE_SELECT =
  "*, reporter:users!disputes_reported_by_fkey(id, name, avatar_url), rental:rentals(id, renter_id, owner_id, deposit_amount, deposit_status, status, item:items(id, title))";

/** GET /api/disputes — disputes on rentals where the user is a party. */
export async function GET() {
  try {
    const { user, admin } = await requireUser();

    const { data, error } = await admin
      .from("disputes")
      .select(DISPUTE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(error.message, 500);

    const mine = (data ?? []).filter(
      (d) => d.rental?.renter_id === user.id || d.rental?.owner_id === user.id
    );
    return NextResponse.json({ disputes: mine });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`dispute:${user.id}`, 10);
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
        evidence_photos: input.evidence_photos ?? [],
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
