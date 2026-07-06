import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    if (user.id !== Number(id)) throw new ApiError("Forbidden", 403);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("Missing file", 400);
    if (!file.type.startsWith("image/")) throw new ApiError("File must be an image", 400);
    if (file.size > MAX_AVATAR_BYTES) throw new ApiError("Image too large (max 5MB)", 400);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("profile-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw new ApiError(uploadError.message, 500);

    const {
      data: { publicUrl },
    } = admin.storage.from("profile-photos").getPublicUrl(path);

    const { data, error } = await admin
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ user: data });
  } catch (err) {
    return handleApiError(err);
  }
}
