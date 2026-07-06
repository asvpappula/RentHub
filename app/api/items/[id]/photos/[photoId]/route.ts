import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

async function getOwnedPhoto(
  itemId: number,
  photoId: number,
  userId: number,
  admin: Awaited<ReturnType<typeof requireUser>>["admin"]
) {
  const { data: item } = await admin
    .from("items")
    .select("owner_id")
    .eq("id", itemId)
    .single();
  if (!item) throw new ApiError("Item not found", 404);
  if (item.owner_id !== userId) throw new ApiError("Forbidden", 403);

  const { data: photo } = await admin
    .from("item_photos")
    .select("*")
    .eq("id", photoId)
    .eq("item_id", itemId)
    .single();
  if (!photo) throw new ApiError("Photo not found", 404);
  return photo;
}

/** Extracts the storage object path from a Supabase public URL. */
function storagePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : decodeURIComponent(url.slice(idx + marker.length));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;
    const { user, admin } = await requireUser();
    const photo = await getOwnedPhoto(Number(id), Number(photoId), user.id, admin);

    const bucket =
      photo.photo_type === "condition" ? "condition-photos" : "item-photos";
    const path = storagePathFromUrl(photo.photo_url, bucket);
    if (path) await admin.storage.from(bucket).remove([path]);

    const { error } = await admin
      .from("item_photos")
      .delete()
      .eq("id", Number(photoId));
    if (error) throw new ApiError(error.message, 400);

    // If the main photo was deleted, promote the oldest remaining one.
    if (photo.photo_type === "main") {
      const { data: next } = await admin
        .from("item_photos")
        .select("id")
        .eq("item_id", Number(id))
        .order("uploaded_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (next)
        await admin
          .from("item_photos")
          .update({ photo_type: "main" })
          .eq("id", next.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({ photo_type: z.enum(["main", "gallery"]) });

/** PUT — set a photo as the main photo (demotes the previous main). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;
    const { user, admin } = await requireUser();
    await getOwnedPhoto(Number(id), Number(photoId), user.id, admin);
    const { photo_type } = await parseBody(request, updateSchema);

    if (photo_type === "main") {
      await admin
        .from("item_photos")
        .update({ photo_type: "gallery" })
        .eq("item_id", Number(id))
        .eq("photo_type", "main");
    }

    const { data, error } = await admin
      .from("item_photos")
      .update({ photo_type })
      .eq("id", Number(photoId))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ photo: data });
  } catch (err) {
    return handleApiError(err);
  }
}
