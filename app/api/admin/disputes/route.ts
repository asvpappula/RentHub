import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";
import { signEvidenceUrls } from "@/lib/evidence";

const SELECT =
  "*, reporter:users!disputes_reported_by_fkey(id, name, avatar_url), rental:rentals(id, renter_id, owner_id, deposit_amount, deposit_status, status, payment_intent_id, item:items(id, title), renter:users!rentals_renter_id_fkey(id, name), owner:users!rentals_owner_id_fkey(id, name))";

/** GET /api/admin/disputes — all disputes (optionally ?status=open). */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = admin.from("disputes").select(SELECT).order("created_at", { ascending: false });
    if (status === "open")
      query = query.in("status", ["pending", "under_review", "appealed"]);
    else if (status) query = query.eq("status", status);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    // Sign evidence + attach payout status per rental.
    const disputes = await Promise.all(
      (data ?? []).map(async (d) => {
        const [{ data: payout }] = await Promise.all([
          admin.from("payouts").select("status, hold_reason").eq("rental_id", d.rental_id).maybeSingle(),
        ]);
        return {
          ...d,
          evidence_photos: await signEvidenceUrls(admin, d.evidence_photos ?? []),
          payout_status: payout?.status ?? null,
          payout_hold_reason: payout?.hold_reason ?? null,
        };
      })
    );

    return NextResponse.json({ disputes });
  } catch (err) {
    return handleApiError(err);
  }
}
