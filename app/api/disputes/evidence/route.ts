import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { generatedObjectName, validateImageUpload } from "@/lib/upload-validation";
import { EVIDENCE_BUCKET_NAME } from "@/lib/evidence";

/**
 * Uploads dispute/claim evidence photos to the PRIVATE condition-photos
 * bucket. Returns object PATHS (not URLs) to store on the dispute/claim;
 * authorized readers get short-lived signed URLs at fetch time.
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`upload:${user.id}`, 60);

    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new ApiError("No files provided", 400);
    if (files.length > 5) throw new ApiError("Maximum 5 evidence photos", 400);

    const paths: string[] = [];
    for (const file of files) {
      const { buffer, contentType, ext } = await validateImageUpload(file);
      const path = generatedObjectName(`evidence/${user.id}`, ext);
      const { error } = await admin.storage
        .from(EVIDENCE_BUCKET_NAME)
        .upload(path, buffer, { contentType });
      if (error) throw new ApiError(error.message, 500);
      paths.push(path);
    }

    // `urls` kept as the response key for client compatibility; values are
    // now private object paths, resolved to signed URLs when read back.
    return NextResponse.json({ urls: paths }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
