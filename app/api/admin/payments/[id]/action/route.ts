import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { getStripeServer } from "@/lib/stripe-server";
import { reverseOrBlockPayout } from "@/lib/payouts";

const schema = z.object({
  action: z.enum(["mark_reviewed", "block_payout", "needs_stripe_action"]),
  reason: z.string().max(2000).optional(),
});

/**
 * Admin action on a chargeback/payment. `[id]` is the RENTAL id.
 * We do NOT auto-submit Stripe dispute evidence (not implemented) — the admin
 * marks it as needing dashboard action. Blocking the payout is real
 * (reverseOrBlockPayout). All actions are audited.
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

    if (action === "needs_stripe_action" && !reason)
      throw new ApiError("Add a note describing the required Stripe action", 400);

    if (action === "block_payout") {
      const stripe = getStripeServer();
      await reverseOrBlockPayout(admin, stripe, rentalId, reason ?? "chargeback_admin");
    }
    // mark_reviewed / needs_stripe_action are audit-only (no fake Stripe calls).

    await logAdminAction(admin, user.id, {
      actionType: `payment_${action}`,
      targetType: "payment",
      targetId: id,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
