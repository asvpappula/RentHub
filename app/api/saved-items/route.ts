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
        "id, created_at, item:items(*, owner:users!items_owner_id_fkey(id, name, avatar_url, average_rating, id_verified, phone_verified, total_reviews, total_rentals, created_at), photos:item_photos(*))"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(error.message, 500);

    // The saver is not the item's owner — keep the private serial out of the
    // wishlist DTO (items(*) would otherwise include it).
    const saved = (data ?? []).map((row) => {
      const it = (row as { item?: unknown }).item;
      const obj = Array.isArray(it) ? it[0] : it;
      if (obj && typeof obj === "object")
        delete (obj as Record<string, unknown>).serial_number;
      return row;
    });

    return NextResponse.json({ saved });
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
