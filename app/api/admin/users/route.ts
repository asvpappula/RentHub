import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";

/** GET /api/admin/users — user directory with moderation-relevant fields. */
export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const filter = searchParams.get("filter"); // suspended | all

    let query = admin
      .from("users")
      .select(
        "id, name, email, phone_verified, id_verified, suspended, suspended_reason, average_rating, total_rentals, created_at"
      )
      .order("created_at", { ascending: false });
    if (filter === "suspended") query = query.eq("suspended", true);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    // Attach connected-account + counts context per user (bounded list).
    const users = await Promise.all(
      (data ?? []).map(async (u) => {
        const [{ count: listings }, { count: rentals }, { data: acct }] = await Promise.all([
          admin.from("items").select("id", { count: "exact", head: true }).eq("owner_id", u.id),
          admin
            .from("rentals")
            .select("id", { count: "exact", head: true })
            .or(`renter_id.eq.${u.id},owner_id.eq.${u.id}`),
          admin
            .from("connected_accounts")
            .select("onboarding_complete")
            .eq("user_id", u.id)
            .maybeSingle(),
        ]);
        return {
          ...u,
          listings_count: listings ?? 0,
          rentals_count: rentals ?? 0,
          payout_onboarded: acct?.onboarding_complete ?? false,
        };
      })
    );
    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}
