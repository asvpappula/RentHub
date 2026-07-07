import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { generatedObjectName, validateImageUpload } from "@/lib/upload-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();
    if (user.id !== Number(id)) throw new ApiError("Forbidden", 403);
    await rateLimit(`upload:${user.id}`, 60);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("Missing file", 400);
    const { buffer, contentType, ext } = await validateImageUpload(file);

    const path = generatedObjectName(String(user.id), ext);
    const { error: uploadError } = await admin.storage
      .from("profile-photos")
      .upload(path, buffer, { upsert: true, contentType });
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
