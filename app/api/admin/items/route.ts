import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";

/** GET /api/admin/items — listing directory for moderation (?filter=hidden). */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const filter = searchParams.get("filter"); // hidden | all

    let query = admin
      .from("items")
      .select(
        "id, title, category, daily_rate, deposit_amount, availability_status, hidden, view_count, rental_count, average_rating, gps_tracking_required, created_at, owner:users!items_owner_id_fkey(id, name, suspended)"
      )
      .order("created_at", { ascending: false });
    if (filter === "hidden") query = query.eq("hidden", true);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query.limit(100);
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}
