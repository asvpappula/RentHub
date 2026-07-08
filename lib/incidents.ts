import { logBookingEvent, type ActorRole } from "@/lib/booking";
import { sendTransactional } from "@/lib/email";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const INCIDENT_LABELS: Record<string, string> = {
  late_return: "Late return",
  damage: "Damage",
  missing_accessory: "Missing accessory",
  missing_item: "Missing item",
  theft_suspected: "Theft suspected",
  wrong_item_returned: "Wrong item returned",
  other: "Issue",
};

interface OpenIncidentArgs {
  rentalId: number;
  openedBy: number;
  againstUserId: number | null;
  type: string;
  description: string;
  evidence?: string[];
  actorRole: ActorRole;
  itemTitle?: string | null;
}

/**
 * Opens a handoff incident, logs the transition, and notifies the party it's
 * against. An open incident blocks payout + automatic deposit release
 * (enforced in releaseOwnerPayout / completeRental), so no money can move while
 * it's unresolved. Evidence is stored as PRIVATE object paths.
 */
export async function openIncident(
  admin: Admin,
  args: OpenIncidentArgs
): Promise<{ id: number }> {
  const { data: incident } = await admin
    .from("incidents")
    .insert({
      rental_id: args.rentalId,
      opened_by: args.openedBy,
      against_user_id: args.againstUserId,
      type: args.type,
      status: "open",
      description: args.description,
      evidence: args.evidence ?? [],
    })
    .select("id")
    .single();

  await logBookingEvent(admin, {
    rentalId: args.rentalId,
    eventType: "incident_opened",
    actorUserId: args.openedBy,
    actorRole: args.actorRole,
    metadata: { incident_id: incident?.id, type: args.type },
  });

  if (args.againstUserId) {
    await sendTransactional(admin, {
      userId: args.againstUserId,
      notificationType: "incident_opened",
      subject: "A handoff issue was reported on your rental",
      body: `An issue (${INCIDENT_LABELS[args.type] ?? args.type}) was reported on the rental of "${args.itemTitle ?? "an item"}". RentHub will review it; the deposit and owner payout stay on hold until it's resolved.`,
      dedupeKey: `incident-${incident?.id}-opened`,
      linkPath: `/rental/${args.rentalId}`,
      relatedRentalId: args.rentalId,
    });
  }

  return { id: incident!.id };
}
