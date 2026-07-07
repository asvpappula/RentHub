import { ApiError } from "@/lib/api-helpers";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED = {
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/webp": {
    ext: "webp",
    // "RIFF" .... "WEBP" — check RIFF prefix; WEBP checked below.
    magic: [[0x52, 0x49, 0x46, 0x46]],
  },
  "image/gif": {
    ext: "gif",
    magic: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ],
  },
} as const;

function matches(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

export interface ValidatedImage {
  buffer: Buffer;
  contentType: keyof typeof ALLOWED;
  ext: string;
}

/**
 * Validates an uploaded image by its ACTUAL bytes, not the client-provided
 * MIME. Blocks SVG (XSS vector), spoofed types, and oversized files. Returns
 * a safe buffer + verified content type + extension. Throws ApiError on any
 * problem so callers get a clean 400.
 */
export async function validateImageUpload(file: File): Promise<ValidatedImage> {
  if (file.size > MAX_IMAGE_BYTES)
    throw new ApiError("Image too large (max 8MB)", 400);
  if (file.size === 0) throw new ApiError("Empty file", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const head = new Uint8Array(buffer.subarray(0, 16));

  // Explicitly reject SVG / XML regardless of declared type.
  const asText = new TextDecoder("utf-8", { fatal: false })
    .decode(buffer.subarray(0, 256))
    .toLowerCase();
  if (asText.includes("<svg") || asText.includes("<?xml") || asText.includes("<!doctype"))
    throw new ApiError("SVG and XML uploads are not allowed", 400);

  for (const [contentType, spec] of Object.entries(ALLOWED)) {
    if (spec.magic.some((m) => matches(head, m))) {
      // WEBP: RIFF header present; confirm the WEBP fourCC at offset 8.
      if (contentType === "image/webp") {
        const webp = String.fromCharCode(...head.subarray(8, 12));
        if (webp !== "WEBP") continue;
      }
      return { buffer, contentType: contentType as keyof typeof ALLOWED, ext: spec.ext };
    }
  }

  throw new ApiError(
    "Unsupported image type — use JPEG, PNG, WebP, or GIF",
    400
  );
}

/** Random, collision-free storage object name (never trust client filenames). */
export function generatedObjectName(prefix: string, ext: string): string {
  const rand = Buffer.from(
    crypto.getRandomValues(new Uint8Array(16))
  ).toString("hex");
  return `${prefix}/${rand}.${ext}`;
}
