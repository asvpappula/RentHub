import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { sendTransactional } from "@/lib/email";

const schema = z.object({
  action: z.enum(["under_review", "request_evidence", "approve", "deny", "close"]),
  reason: z.string().max(2000).optional(),
  approved_amount: z.number().int().min(0).max(500).optional(),
});

/**
 * Admin review of a damage-protection claim. NOTE: RentHub does not operate an
 * automated insurance fund — approving a claim records the human decision and
 * notifies the parties; actual compensation is handled via the deposit
 * capture on the linked dispute (owner-favour resolution). This keeps the
 * "protection" promise honest: a human reviews, no fake automatic payout.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireAdmin();
    const { action, reason, approved_amount } = await parseBody(request, schema);

    const { data: claim } = await admin
      .from("insurance_claims")
      .select("*, rental:rentals(id, renter_id, owner_id, item:items(title))")
      .eq("id", Number(id))
      .single();
    if (!claim) throw new ApiError("Claim not found", 404);
    const rental = claim.rental;
    const itemTitle = rental?.item?.title ?? "your rental";

    const statusMap: Record<string, string> = {
      under_review: "under_review",
      request_evidence: "under_review",
      approve: "approved",
      deny: "rejected",
      close: "rejected",
    };

    const update: Record<string, unknown> = { status: statusMap[action] };
    if (action === "approve" || action === "deny" || action === "close") {
      update.resolved_by = user.id;
      update.resolved_at = new Date().toISOString();
      update.resolution_notes = reason ?? null;
      if (action === "approve" && approved_amount != null)
        update.approved_amount_cents = approved_amount * 100;
    }

    await admin.from("insurance_claims").update(update).eq("id", Number(id));

    if (action === "request_evidence" && rental) {
      await sendTransactional(admin, {
        userId: claim.claimant_id,
        notificationType: "dispute",
        subject: "More evidence needed for your claim",
        body: `We're reviewing your claim on "${itemTitle}" and need more evidence. Add photos or receipts from the rental page.`,
        dedupeKey: `claim-${id}-evidence-${Date.now()}`,
        relatedRentalId: rental.id,
      });
    } else if ((action === "approve" || action === "deny") && rental) {
      const decision =
        action === "approve"
          ? `approved${approved_amount != null ? ` for $${approved_amount}` : ""} — compensation is handled through the deposit on this rental`
          : "not approved after review";
      await sendTransactional(admin, {
        userId: claim.claimant_id,
        notificationType: "dispute",
        subject: `Your protection claim was ${action === "approve" ? "approved" : "reviewed"}`,
        body: `Your claim on "${itemTitle}" was ${decision}.${reason ? ` Note: ${reason}` : ""}`,
        dedupeKey: `claim-${id}-${action}`,
        relatedRentalId: rental.id,
      });
    }

    await logAdminAction(admin, user.id, {
      actionType: `claim_${action}`,
      targetType: "claim",
      targetId: id,
      reason,
      metadata: { approved_amount },
    });

    const { data: fresh } = await admin
      .from("insurance_claims")
      .select("*")
      .eq("id", Number(id))
      .single();
    return NextResponse.json({ claim: fresh });
  } catch (err) {
    return handleApiError(err);
  }
}
