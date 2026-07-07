import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireActiveUser,
} from "@/lib/api-helpers";
import { createItemSchema } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { checkFraudRisk } from "@/lib/fraud";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const ownerId = searchParams.get("ownerId");
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE))
    );

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("items")
      .select(
        "*, owner:users!items_owner_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified), photos:item_photos(*)",
        { count: "exact" }
      );

    // Public browse: only available, non-hidden listings. Owners viewing their
    // own listings (ownerId filter) still see hidden ones (marked in the UI).
    if (!ownerId) {
      query = query.eq("availability_status", "available").eq("hidden", false);
    }
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (category) query = query.eq("category", category);
    if (minPrice) query = query.gte("daily_rate", Number(minPrice));
    if (maxPrice) query = query.lte("daily_rate", Number(maxPrice));
    if (ownerId) query = query.eq("owner_id", Number(ownerId));

    if (sort === "price_asc") query = query.order("daily_rate", { ascending: true });
    else if (sort === "price_desc") query = query.order("daily_rate", { ascending: false });
    else if (sort === "rating") query = query.order("average_rating", { ascending: false, nullsFirst: false });
    else query = query.order("created_at", { ascending: false });

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);

    // A page past the last one is an empty page, not an error (PGRST103).
    if (error && error.code === "PGRST103") {
      return NextResponse.json({
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      });
    }
    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireActiveUser();
    const input = await parseBody(request, createItemSchema);

    const { riskLevel } = await checkFraudRisk(admin, user);
    if (riskLevel === "high")
      throw new ApiError(
        "Complete verification to list items — verify your phone and ID in Settings.",
        403
      );

    const { data, error } = await admin
      .from("items")
      .insert({ ...input, owner_id: user.id })
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
