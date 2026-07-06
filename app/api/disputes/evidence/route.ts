import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Uploads dispute evidence photos to the condition-photos bucket,
 *  returning public URLs to attach when the dispute is filed. */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();

    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new ApiError("No files provided", 400);
    if (files.length > 5) throw new ApiError("Maximum 5 evidence photos", 400);

    const urls: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/"))
        throw new ApiError("Files must be images", 400);
      if (file.size > MAX_PHOTO_BYTES)
        throw new ApiError("Image too large (max 8MB)", 400);

      const ext = file.name.split(".").pop() || "jpg";
      const path = `disputes/${user.id}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const { error } = await admin.storage
        .from("condition-photos")
        .upload(path, file, { contentType: file.type });
      if (error) throw new ApiError(error.message, 500);

      const {
        data: { publicUrl },
      } = admin.storage.from("condition-photos").getPublicUrl(path);
      urls.push(publicUrl);
    }

    return NextResponse.json({ urls }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
