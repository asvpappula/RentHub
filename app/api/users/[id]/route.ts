import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";
import { updateUserSchema } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("users")
      .select(
        "id, name, avatar_url, bio, phone_verified, id_verified, background_check_status, average_rating, total_reviews, total_rentals, created_at"
      )
      .eq("id", Number(id))
      .single();
    if (!data) throw new ApiError("User not found", 404);
    return NextResponse.json({ user: data });
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
    if (user.id !== Number(id)) throw new ApiError("Forbidden", 403);

    const updates = await parseBody(request, updateUserSchema);
    const { data, error } = await admin
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ user: data });
  } catch (err) {
    return handleApiError(err);
  }
}
