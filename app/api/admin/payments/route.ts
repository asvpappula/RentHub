import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";

const SELECT =
  "*, renter:users!payments_renter_id_fkey(id, name), owner:users!payments_owner_id_fkey(id, name), rental:rentals(id, status, item:items(id, title))";

/**
 * GET /api/admin/payments — payments with a chargeback/dispute by default
 * (?all=1 for the full ledger, ?status=refunded, etc.).
 */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "1";
    const status = searchParams.get("status");

    let query = admin.from("payments").select(SELECT).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    else if (!all) query = query.not("dispute_status", "is", null);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    // Attach payout status for context.
    const payments = await Promise.all(
      (data ?? []).map(async (p) => {
        const { data: payout } = await admin
          .from("payouts")
          .select("status")
          .eq("rental_id", p.rental_id)
          .maybeSingle();
        return { ...p, payout_status: payout?.status ?? null };
      })
    );
    return NextResponse.json({ payments });
  } catch (err) {
    return handleApiError(err);
  }
}
