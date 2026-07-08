import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";
import { signEvidenceUrls } from "@/lib/evidence";

/**
 * Admin incident queue. Returns incidents (default: unresolved) with the rental,
 * the parties, and short-lived SIGNED evidence URLs (never public paths).
 */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = admin
      .from("incidents")
      .select(
        "*, rental:rentals(id, item:items(title, serial_number), renter_id, owner_id, deposit_status), opener:users!incidents_opened_by_fkey(id, name)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status && status !== "all") query = query.eq("status", status);
    else query = query.in("status", ["open", "under_review", "awaiting_evidence"]);

    const { data } = await query;
    const incidents = await Promise.all(
      (data ?? []).map(async (i) => ({
        ...i,
        evidence_urls: await signEvidenceUrls(admin, i.evidence ?? []),
      }))
    );

    return NextResponse.json({ incidents });
  } catch (err) {
    return handleApiError(err);
  }
}
