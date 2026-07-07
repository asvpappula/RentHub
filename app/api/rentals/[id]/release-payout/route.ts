import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";
import { releaseOwnerPayout } from "@/lib/payouts";

/**
 * Backend-only, ADMIN-only payout release. Owners and renters cannot call
 * this — the normal happy-path release happens automatically inside rental
 * completion. This endpoint is the manual/admin override (e.g. after a
 * dispute is resolved in the owner's favor).
 *
 * All eligibility (open dispute/claim, onboarding, double-release) is enforced
 * inside releaseOwnerPayout(); this route only checks the admin identity.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    if (!user.is_admin) throw new ApiError("Admin only", 403);

    const stripe = getStripeServer();
    const result = await releaseOwnerPayout(admin, stripe, Number(id), user.id);

    if (!result.released)
      throw new ApiError(`Payout not released: ${result.reason}`, 409);
    return NextResponse.json({ ok: true, transferId: result.transferId });
  } catch (err) {
    return handleApiError(err);
  }
}
