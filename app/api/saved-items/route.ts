import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

/** GET /api/saved-items — the current user's wishlist. */
export async function GET() {
  try {
    const { user, admin } = await requireUser();

    const { data, error } = await admin
      .from("saved_items")
      .select(
        "id, created_at, item:items(*, owner:users!items_owner_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified, background_check_status), photos:item_photos(*))"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({ saved: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({ item_id: z.number().int().positive() });

/** POST /api/saved-items — save an item (idempotent). */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { item_id } = await parseBody(request, schema);

    const { data: item } = await admin
      .from("items")
      .select("id")
      .eq("id", item_id)
      .single();
    if (!item) throw new ApiError("Item not found", 404);

    const { error } = await admin
      .from("saved_items")
      .upsert(
        { user_id: user.id, item_id },
        { onConflict: "user_id,item_id", ignoreDuplicates: true }
      );
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
