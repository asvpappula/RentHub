import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Incident statuses that BLOCK payout + automatic deposit release. */
export const BLOCKING_INCIDENT_STATUSES = [
  "open",
  "under_review",
  "awaiting_evidence",
] as const;

export const INCIDENT_TYPES = [
  "late_return",
  "damage",
  "missing_accessory",
  "missing_item",
  "theft_suspected",
  "wrong_item_returned",
  "other",
] as const;

export type ActorRole = "renter" | "owner" | "admin" | "system";

interface BookingEventInput {
  rentalId: number;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: number | null;
  actorRole?: ActorRole;
  metadata?: Record<string, unknown>;
}

/** Appends an immutable transition record to the booking audit log. */
export async function logBookingEvent(
  admin: Admin,
  input: BookingEventInput
): Promise<void> {
  await admin.from("booking_state_events").insert({
    rental_id: input.rentalId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? null,
    metadata: input.metadata ?? {},
  });
}

/** True when an unresolved incident is open on the rental (blocks release). */
export async function hasBlockingIncident(
  admin: Admin,
  rentalId: number
): Promise<boolean> {
  const { count } = await admin
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("rental_id", rentalId)
    .in("status", BLOCKING_INCIDENT_STATUSES as unknown as string[]);
  return (count ?? 0) > 0;
}

/**
 * A one-time 6-digit pickup PIN the renter shows the owner at handoff. The
 * owner must enter it to confirm pickup — proves the two parties physically met.
 */
export function generatePickupCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Whether an active rental is past its due date (late). */
export function isRentalLate(rental: {
  status: string;
  end_date: string;
  return_status?: string | null;
}): boolean {
  if (rental.status !== "active" && rental.status !== "confirmed") return false;
  if (rental.return_status === "submitted" || rental.return_status === "accepted")
    return false;
  const today = new Date().toISOString().slice(0, 10);
  return rental.end_date < today;
}
