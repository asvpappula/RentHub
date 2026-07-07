import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";

/**
 * Marks a webhook event as reviewed by ops. We do NOT auto-replay events —
 * dedupe (webhook_events PK) means a genuine Stripe re-delivery is handled
 * idempotently; blind replay is unsafe, so this is review-only.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireAdmin();

    await admin
      .from("webhook_events")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("event_id", id);

    await logAdminAction(admin, user.id, {
      actionType: "webhook_reviewed",
      targetType: "webhook_event",
      targetId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
