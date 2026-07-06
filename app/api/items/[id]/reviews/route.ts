import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

/**
 * Reviews for an item: ratings left by renters on completed rentals.
 * (The schema stores star ratings on rentals — there is no separate
 * review-text table.)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createSupabaseAdminClient();

    const { data } = await admin
      .from("rentals")
      .select(
        "id, owner_rating, updated_at, renter:users!rentals_renter_id_fkey(id, name, avatar_url)"
      )
      .eq("item_id", Number(id))
      .not("owner_rating", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      reviews: (data ?? []).map((r) => ({
        id: r.id,
        rating: r.owner_rating,
        date: r.updated_at,
        reviewer: r.renter,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
