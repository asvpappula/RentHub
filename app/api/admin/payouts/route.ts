import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";

const SELECT =
  "*, owner:users!payouts_owner_id_fkey(id, name, suspended), rental:rentals(id, status, item:items(id, title)), payment:payments(status, dispute_status, amount_cents)";

/** GET /api/admin/payouts — held / failed / blocked payouts (default), or ?status=. */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = admin.from("payouts").select(SELECT).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    else query = query.in("status", ["pending", "releasing", "blocked", "failed", "reversing"]);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return NextResponse.json({ payouts: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}
