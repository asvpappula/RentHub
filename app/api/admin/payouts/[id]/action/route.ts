import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { getStripeServer } from "@/lib/stripe-server";
import { releaseOwnerPayout, reverseOrBlockPayout } from "@/lib/payouts";

const schema = z.object({
  action: z.enum(["release", "block", "under_review"]),
  reason: z.string().max(2000).optional(),
});

/**
 * Admin payout action. Release and block DELEGATE to the shared server
 * functions (no duplicated payout logic, all guards intact & idempotent):
 *  - release: releaseOwnerPayout — refuses if rental incomplete, disputed,
 *    refunded, charged back, owner suspended/not onboarded, or already paid.
 *  - block:   reverseOrBlockPayout — blocks a held payout or reverses a
 *    transferred one.
 * `[id]` is the RENTAL id (payouts are 1:1 with rentals).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rentalId = Number(id);
    const { user, admin } = await requireAdmin();
    const { action, reason } = await parseBody(request, schema);

    const stripe = getStripeServer();
    let result: unknown = null;

    if (action === "release") {
      const r = await releaseOwnerPayout(admin, stripe, rentalId, user.id);
      if (!r.released) throw new ApiError(`Payout not released: ${r.reason}`, 409);
      result = r;
    } else if (action === "block") {
      await reverseOrBlockPayout(admin, stripe, rentalId, reason ?? "admin_block");
      result = { blocked: true };
    } else if (action === "under_review") {
      await admin
        .from("payouts")
        .update({ hold_reason: reason ?? "admin_review", updated_at: new Date().toISOString() })
        .eq("rental_id", rentalId)
        .eq("status", "pending");
      result = { under_review: true };
    }

    await logAdminAction(admin, user.id, {
      actionType: `payout_${action}`,
      targetType: "payout",
      targetId: id,
      reason,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}
