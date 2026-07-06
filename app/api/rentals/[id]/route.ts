import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

const RENTAL_SELECT =
  "*, item:items(*, photos:item_photos(*)), renter:users!rentals_renter_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified), owner:users!rentals_owner_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified)";

const updateSchema = z.object({
  status: z.enum(["cancelled"]).optional(),
  renter_rating: z.number().int().min(1).max(5).optional(),
  owner_rating: z.number().int().min(1).max(5).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: rental } = await admin
      .from("rentals")
      .select(RENTAL_SELECT)
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id && rental.owner_id !== user.id)
      throw new ApiError("Forbidden", 403);

    return NextResponse.json({ rental });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    const input = await parseBody(request, updateSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*")
      .eq("id", Number(id))
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);

    const isRenter = rental.renter_id === user.id;
    const isOwner = rental.owner_id === user.id;
    if (!isRenter && !isOwner) throw new ApiError("Forbidden", 403);

    const updates: Record<string, unknown> = {};

    if (input.status === "cancelled") {
      if (!isRenter) throw new ApiError("Only the renter can cancel", 403);
      if (!["pending", "approved"].includes(rental.status))
        throw new ApiError("This rental can no longer be cancelled", 409);
      updates.status = "cancelled";
    }

    // owner_rating = rating the renter gives the owner; renter_rating = vice versa.
    if (input.owner_rating !== undefined) {
      if (!isRenter) throw new ApiError("Only the renter rates the owner", 403);
      if (rental.status !== "completed")
        throw new ApiError("You can rate after the rental completes", 409);
      updates.owner_rating = input.owner_rating;
    }
    if (input.renter_rating !== undefined) {
      if (!isOwner) throw new ApiError("Only the owner rates the renter", 403);
      if (rental.status !== "completed")
        throw new ApiError("You can rate after the rental completes", 409);
      updates.renter_rating = input.renter_rating;
    }

    if (Object.keys(updates).length === 0)
      throw new ApiError("Nothing to update", 400);

    const { data, error } = await admin
      .from("rentals")
      .update(updates)
      .eq("id", Number(id))
      .select(RENTAL_SELECT)
      .single();
    if (error) throw new ApiError(error.message, 400);

    // Refresh the rated user's aggregate rating.
    const ratedUserId =
      updates.owner_rating !== undefined
        ? rental.owner_id
        : updates.renter_rating !== undefined
          ? rental.renter_id
          : null;
    if (ratedUserId) {
      const [{ data: ownerRatings }, { data: renterRatings }] = await Promise.all([
        admin.from("rentals").select("owner_rating").eq("owner_id", ratedUserId).not("owner_rating", "is", null),
        admin.from("rentals").select("renter_rating").eq("renter_id", ratedUserId).not("renter_rating", "is", null),
      ]);
      const all = [
        ...(ownerRatings ?? []).map((r) => r.owner_rating as number),
        ...(renterRatings ?? []).map((r) => r.renter_rating as number),
      ];
      if (all.length > 0) {
        await admin
          .from("users")
          .update({
            average_rating: (all.reduce((a, b) => a + b, 0) / all.length).toFixed(2),
            total_reviews: all.length,
          })
          .eq("id", ratedUserId);
      }
    }

    return NextResponse.json({ rental: data });
  } catch (err) {
    return handleApiError(err);
  }
}
