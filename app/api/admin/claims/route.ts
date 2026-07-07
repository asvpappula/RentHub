import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";
import { signEvidenceUrls } from "@/lib/evidence";

const SELECT =
  "*, claimant:users!insurance_claims_claimant_id_fkey(id, name), rental:rentals(id, renter_id, owner_id, deposit_amount, deposit_status, item:items(id, title))";

/** GET /api/admin/claims — all protection claims (optionally ?status=open). */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = admin.from("insurance_claims").select(SELECT).order("created_at", { ascending: false });
    if (status === "open") query = query.in("status", ["pending", "under_review"]);
    else if (status) query = query.eq("status", status);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    const claims = await Promise.all(
      (data ?? []).map(async (c) => ({
        ...c,
        photo_urls: await signEvidenceUrls(admin, c.photo_urls ?? []),
      }))
    );
    return NextResponse.json({ claims });
  } catch (err) {
    return handleApiError(err);
  }
}
