import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  rateLimit,
  requireActiveUser,
} from "@/lib/api-helpers";
import { confirmPickupSchema } from "@/lib/validation";
import { logBookingEvent } from "@/lib/booking";
import { sendTransactional } from "@/lib/email";

/**
 * Owner confirms physical pickup by entering the renter's 6-digit pickup code.
 * Backend-authoritative: proves the two parties met. Moves confirmed → active.
 *
 * - Owner only; renter cannot mark pickup complete.
 * - Requires the correct pickup code (no code → no pickup).
 * - Suspended users are blocked (requireActiveUser).
 * - Idempotent: repeated confirms are a safe no-op (CAS on status='confirmed').
 * - Evidence photos are PRIVATE object paths (signed on read).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rentalId = Number(id);
    const { user, admin } = await requireActiveUser();
    await rateLimit(`pickup:${user.id}`, 20);
    const input = await parseBody(request, confirmPickupSchema);

    const { data: rental } = await admin
      .from("rentals")
      .select("*, item:items(title)")
      .eq("id", rentalId)
      .single();
    if (!rental) throw new ApiError("Rental not found", 404);
    if (rental.owner_id !== user.id)
      throw new ApiError("Only the owner can confirm pickup", 403);

    // Idempotent: already picked up.
    if (rental.pickup_confirmed_at || rental.status === "active")
      return NextResponse.json({ ok: true, alreadyConfirmed: true });

    if (rental.status !== "confirmed")
      throw new ApiError(
        "Pickup can only be confirmed on a paid, confirmed rental",
        409
      );
    if (!rental.pickup_code || input.code !== rental.pickup_code)
      throw new ApiError("Incorrect pickup code", 403);

    // CAS confirmed → active; only the winner sets pickup fields + notifies.
    const { data: claimed } = await admin
      .from("rentals")
      .update({
        status: "active",
        pickup_confirmed_at: new Date().toISOString(),
        pickup_confirmed_by: user.id,
        pickup_photos: input.photos ?? [],
        pickup_notes: input.notes ?? null,
        pickup_accessories: input.accessories ?? [],
      })
      .eq("id", rentalId)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();
    if (!claimed) return NextResponse.json({ ok: true, alreadyConfirmed: true });

    const itemTitle = Array.isArray(rental.item)
      ? rental.item[0]?.title
      : (rental.item as { title?: string } | null)?.title;

    await logBookingEvent(admin, {
      rentalId,
      eventType: "pickup_confirmed",
      fromStatus: "confirmed",
      toStatus: "active",
      actorUserId: user.id,
      actorRole: "owner",
      metadata: { photos: (input.photos ?? []).length },
    });

    await sendTransactional(admin, {
      userId: rental.renter_id,
      notificationType: "pickup_confirmed",
      subject: "Pickup confirmed — your rental is active",
      body: `Your rental of "${itemTitle ?? "the item"}" is now active. Return it by the due date, then submit return photos so the owner can review.`,
      dedupeKey: `rental-${rentalId}-pickup`,
      linkPath: `/rental/${rentalId}`,
      relatedRentalId: rentalId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
