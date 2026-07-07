import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

const COVERAGE_LIMIT = 500;

const createSchema = z.object({
  rental_id: z.number().int().positive(),
  claim_type: z.enum(["damage", "theft", "loss"]),
  description: z.string().min(10, "Describe what happened (10+ characters)").max(5000),
  photo_urls: z.array(z.url()).max(5).default([]),
  estimated_value: z
    .number()
    .int()
    .positive()
    .max(COVERAGE_LIMIT, `Coverage is capped at $${COVERAGE_LIMIT} per rental`),
});

const CLAIM_SELECT =
  "*, claimant:users!insurance_claims_claimant_id_fkey(id, name, avatar_url), rental:rentals(id, renter_id, owner_id, item:items(id, title))";

/** GET /api/claims — insurance claims on rentals where the user is a party. */
export async function GET() {
  try {
    const { user, admin } = await requireUser();
    const { data, error } = await admin
      .from("insurance_claims")
      .select(CLAIM_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(error.message, 500);

    const mine = (data ?? []).filter(
      (c) => c.rental?.renter_id === user.id || c.rental?.owner_id === user.id
    );
    return NextResponse.json({ claims: mine });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/claims — file an insurance claim on a rental you're party to. */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const input = await parseBody(request, createSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", input.rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.renter_id !== user.id && rental.owner_id !== user.id)
      throw new ApiError("Forbidden", 403);
    if (!["active", "completed", "disputed"].includes(rental.status))
      throw new ApiError("Claims can be filed on active or finished rentals", 409);

    const { count } = await admin
      .from("insurance_claims")
      .select("id", { count: "exact", head: true })
      .eq("rental_id", input.rental_id)
      .eq("claimant_id", user.id);
    if ((count ?? 0) > 0)
      throw new ApiError("You already filed a claim on this rental", 409);

    const { data: claim, error } = await admin
      .from("insurance_claims")
      .insert({
        rental_id: input.rental_id,
        claimant_id: user.id,
        claim_type: input.claim_type,
        description: input.description,
        photo_urls: input.photo_urls,
        estimated_value: input.estimated_value,
      })
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    const otherParty =
      rental.renter_id === user.id ? rental.owner_id : rental.renter_id;
    await createNotification(
      admin,
      otherParty,
      "dispute",
      "Insurance claim filed",
      `${user.name ?? "The other party"} filed a $${input.estimated_value} ${input.claim_type} claim on "${rental.item?.title}". RentHub will review it.`,
      input.rental_id
    );

    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
