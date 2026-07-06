import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("item_photos")
      .select("*")
      .eq("item_id", Number(id))
      .order("uploaded_at", { ascending: true });
    return NextResponse.json({ photos: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    const { user, admin } = await requireUser();

    const { data: item } = await admin
      .from("items")
      .select("owner_id")
      .eq("id", itemId)
      .single();
    if (!item) throw new ApiError("Item not found", 404);
    if (item.owner_id !== user.id) throw new ApiError("Forbidden", 403);

    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const photoType = (form.get("photo_type") as string) || "main";
    if (files.length === 0) throw new ApiError("No files provided", 400);

    const { count: existingCount } = await admin
      .from("item_photos")
      .select("id", { count: "exact", head: true })
      .eq("item_id", itemId);
    if ((existingCount ?? 0) + files.length > 10)
      throw new ApiError("Maximum 10 photos per item", 400);

    const bucket = photoType === "condition" ? "condition-photos" : "item-photos";
    const created = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) throw new ApiError("Files must be images", 400);
      if (file.size > MAX_PHOTO_BYTES) throw new ApiError("Image too large (max 8MB)", 400);

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${itemId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw new ApiError(uploadError.message, 500);

      const {
        data: { publicUrl },
      } = admin.storage.from(bucket).getPublicUrl(path);

      const { data: photo, error } = await admin
        .from("item_photos")
        .insert({ item_id: itemId, photo_url: publicUrl, photo_type: photoType })
        .select()
        .single();
      if (error) throw new ApiError(error.message, 400);
      created.push(photo);
    }

    return NextResponse.json({ photos: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
