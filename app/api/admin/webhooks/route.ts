import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";

/** GET /api/admin/webhooks — recent webhook events (?status=error for failures). */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = admin
      .from("webhook_events")
      .select("event_id, type, status, error, received_at, reviewed_at")
      .order("received_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}
