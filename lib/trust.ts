import type { User } from "@/types";

type TrustFields = Partial<
  Pick<
    User,
    | "phone_verified"
    | "id_verified"
    | "average_rating"
    | "total_reviews"
    | "total_rentals"
    | "created_at"
  >
>;

export interface TrustBreakdownItem {
  key: string;
  label: string;
  points: number;
  earned: boolean;
  hint: string;
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

/**
 * Trust score (0–100).
 *
 * Verification base (max 80): email +25 · phone +25 · government ID +30.
 * Earned over time (max +20): high ratings +10 · clean claims record +5 ·
 * 6-month account age +3 · 10+ completed rentals +2.
 *
 * The claims-record bonus needs the user's claims history, which isn't on
 * the public profile row — pass `cleanClaimsRecord` where it's known (the
 * personal /trust page); elsewhere it simply isn't counted yet.
 */
export function trustBreakdown(
  user: TrustFields,
  opts?: { cleanClaimsRecord?: boolean }
): TrustBreakdownItem[] {
  const rating = user.average_rating != null ? Number(user.average_rating) : null;
  const accountAgeOk = user.created_at
    ? Date.now() - new Date(user.created_at).getTime() >= SIX_MONTHS_MS
    : false;

  return [
    {
      key: "email",
      label: "Email verified",
      points: 25,
      earned: true, // active accounts can't exist without it
      hint: "Confirmed automatically at signup — you can't log in without it.",
    },
    {
      key: "phone",
      label: "Phone verified",
      points: 25,
      earned: !!user.phone_verified,
      hint: "Verify with an SMS code in Settings — takes under a minute.",
    },
    {
      key: "id",
      label: "Government ID verified",
      points: 30,
      earned: !!user.id_verified,
      hint: "Photograph your ID and take a selfie via Stripe Identity in Settings.",
    },
    {
      key: "ratings",
      label: "Highly rated (4.5★+ across 3+ reviews)",
      points: 10,
      earned: rating != null && rating >= 4.5 && (user.total_reviews ?? 0) >= 3,
      hint: "Earn great ratings from the people you rent with.",
    },
    {
      key: "claims",
      label: "Clean claims record (5+ rentals, no claims against you)",
      points: 5,
      earned: opts?.cleanClaimsRecord === true,
      hint: "Complete 5+ rentals without an insurance claim filed against you.",
    },
    {
      key: "age",
      label: "Member for 6+ months",
      points: 3,
      earned: accountAgeOk,
      hint: "Stick around — long-standing accounts earn extra trust.",
    },
    {
      key: "rentals",
      label: "10+ completed rentals",
      points: 2,
      earned: (user.total_rentals ?? 0) >= 10,
      hint: "Keep renting and lending to build your track record.",
    },
  ];
}

export function trustScore(
  user: TrustFields,
  opts?: { cleanClaimsRecord?: boolean }
): number {
  return trustBreakdown(user, opts)
    .filter((i) => i.earned)
    .reduce((sum, i) => sum + i.points, 0);
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
