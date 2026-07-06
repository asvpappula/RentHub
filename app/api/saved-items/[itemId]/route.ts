import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

/** DELETE /api/saved-items/[itemId] — remove an item from the wishlist. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { user, admin } = await requireUser();

    const { error } = await admin
      .from("saved_items")
      .delete()
      .eq("user_id", user.id)
      .eq("item_id", Number(itemId));
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ saved: false });
  } catch (err) {
    return handleApiError(err);
  }
}
