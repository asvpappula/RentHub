import type { User } from "@/types";

type TrustFields = Pick<
  User,
  "phone_verified" | "id_verified" | "background_check_status"
>;

/**
 * Verification-based trust score (0–100).
 * Email +25 · Phone +25 · ID +30 · Background check +20.
 * Email counts as verified for any active account: Supabase Auth refuses to
 * create a session until the address is confirmed.
 */
export function trustScore(user: TrustFields): number {
  let score = 25;
  if (user.phone_verified) score += 25;
  if (user.id_verified) score += 30;
  if (user.background_check_status === "approved") score += 20;
  return score;
}

export type TrustLevel = "low" | "medium" | "high";

export function trustLevel(score: number): TrustLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export const TRUST_COLORS: Record<TrustLevel, string> = {
  low: "text-rose-600",
  medium: "text-amber-600",
  high: "text-primary-600",
};

export const TRUST_STROKE: Record<TrustLevel, string> = {
  low: "stroke-rose-500",
  medium: "stroke-amber-500",
  high: "stroke-primary-500",
};
