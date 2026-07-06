import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

/** Ratings this user has received, both as renter and as owner. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const admin = createSupabaseAdminClient();

    const [asOwner, asRenter] = await Promise.all([
      admin
        .from("rentals")
        .select("id, owner_rating, created_at, renter:users!rentals_renter_id_fkey(id, name, avatar_url)")
        .eq("owner_id", userId)
        .not("owner_rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("rentals")
        .select("id, renter_rating, created_at, owner:users!rentals_owner_id_fkey(id, name, avatar_url)")
        .eq("renter_id", userId)
        .not("renter_rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      asOwner: asOwner.data ?? [],
      asRenter: asRenter.data ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
