import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  rateLimit,
  requireActiveUser,
} from "@/lib/api-helpers";
import { createIncidentSchema } from "@/lib/validation";
import { openIncident } from "@/lib/incidents";

/**
 * A participant (renter or owner) opens a handoff incident on their rental —
 * e.g. damage, missing accessory, wrong item, theft suspicion. Opening an
 * incident BLOCKS payout + automatic deposit release until an admin resolves
 * it. Suspended users are blocked. Evidence photos are PRIVATE object paths.
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireActiveUser();
    await rateLimit(`incident:${user.id}`, 20);
    const input = await parseBody(request, createIncidentSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("id, renter_id, owner_id, status, item:items(title)")
      .eq("id", input.rental_id)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);

    const isOwner = rental.owner_id === user.id;
    const isRenter = rental.renter_id === user.id;
    if (!isOwner && !isRenter) throw new ApiError("Forbidden", 403);
    if (!["confirmed", "active", "completed", "disputed"].includes(rental.status))
      throw new ApiError(
        "Incidents can only be opened on an active or completed rental",
        409
      );

    const itemTitle = Array.isArray(rental.item)
      ? rental.item[0]?.title
      : (rental.item as { title?: string } | null)?.title;

    const incident = await openIncident(admin, {
      rentalId: rental.id,
      openedBy: user.id,
      againstUserId: isOwner ? rental.renter_id : rental.owner_id,
      type: input.type,
      description: input.description,
      evidence: input.evidence ?? [],
      actorRole: isOwner ? "owner" : "renter",
      itemTitle,
    });

    return NextResponse.json({ incident_id: incident.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
