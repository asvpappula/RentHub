import type { createSupabaseAdminClient } from "@/lib/supabase-server";

const EVIDENCE_BUCKET = "condition-photos";
const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Evidence (damage/theft/claim) photos live in a PRIVATE bucket. We store the
 * object path in the DB and mint short-lived signed URLs only when an
 * authorized party reads the record.
 *
 * Handles legacy rows that stored a full public URL by extracting the path.
 */
export function evidencePathFromStored(value: string): string {
  const marker = `/object/public/${EVIDENCE_BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx !== -1) return decodeURIComponent(value.slice(idx + marker.length));
  const signedMarker = `/object/sign/${EVIDENCE_BUCKET}/`;
  const sIdx = value.indexOf(signedMarker);
  if (sIdx !== -1) {
    const rest = value.slice(sIdx + signedMarker.length);
    return decodeURIComponent(rest.split("?")[0]);
  }
  return value; // already a bare path
}

export async function signEvidenceUrls(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  stored: string[]
): Promise<string[]> {
  if (!stored || stored.length === 0) return [];
  const paths = stored.map(evidencePathFromStored);
  const { data } = await admin.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrls(paths, SIGNED_TTL_SECONDS);
  return (data ?? [])
    .map((d) => d.signedUrl)
    .filter((u): u is string => typeof u === "string");
}

export const EVIDENCE_BUCKET_NAME = EVIDENCE_BUCKET;
