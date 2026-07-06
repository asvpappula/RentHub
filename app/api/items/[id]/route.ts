import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { updateItemSchema } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    const admin = createSupabaseAdminClient();

    const { data } = await admin
      .from("items")
      .select(
        "*, owner:users!items_owner_id_fkey(id, name, avatar_url, bio, average_rating, total_reviews, total_rentals, id_verified, phone_verified, background_check_status, created_at), photos:item_photos(*)"
      )
      .eq("id", itemId)
      .single();
    if (!data) throw new ApiError("Item not found", 404);

    // Fire-and-forget view counter.
    admin
      .from("items")
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq("id", itemId)
      .then(() => {});

    return NextResponse.json({ item: data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: item } = await admin
      .from("items")
      .select("owner_id")
      .eq("id", Number(id))
      .single();
    if (!item) throw new ApiError("Item not found", 404);
    if (item.owner_id !== user.id) throw new ApiError("Forbidden", 403);

    const updates = await parseBody(request, updateItemSchema);
    const { data, error } = await admin
      .from("items")
      .update(updates)
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ item: data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: item } = await admin
      .from("items")
      .select("owner_id")
      .eq("id", Number(id))
      .single();
    if (!item) throw new ApiError("Item not found", 404);
    if (item.owner_id !== user.id) throw new ApiError("Forbidden", 403);

    const { count } = await admin
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("item_id", Number(id))
      .in("status", ["pending", "approved", "confirmed", "active"]);
    if ((count ?? 0) > 0)
      throw new ApiError("Cannot delete an item with active rentals", 409);

    const { error } = await admin.from("items").delete().eq("id", Number(id));
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
