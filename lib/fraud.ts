import type { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { User } from "@/types";

export type RiskLevel = "low" | "medium" | "high";

export interface FraudResult {
  riskLevel: RiskLevel;
  score: number;
  flags: string[];
}

/**
 * Rule-based risk scoring, run before rentals and listings are accepted.
 *
 * Points: new account +30 · phone unverified +20 · ID unverified +25 ·
 * low rating +20 · >2 damage claims in 30d +30 · >1 theft report +40 ·
 * >5 rentals in 24h +20. (Email is always verified for active accounts —
 * Supabase refuses to create a session until the address is confirmed.)
 *
 * Levels: high >= 80 (blocked), medium >= 40 (allowed, surfaced to the
 * counterpart as an "unverified" warning), low otherwise.
 *
 * Note: a brand-new account with no phone/ID verification scores 75 —
 * deliberately medium, not high, so new users can still transact while
 * phone/ID verification integrations (Twilio, Stripe Identity) are pending.
 */
export async function checkFraudRisk(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  user: User
): Promise<FraudResult> {
  let score = 0;
  const flags: string[] = [];
  const now = Date.now();

  const accountAgeDays =
    (now - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 7) {
    score += 30;
    flags.push("new_account");
  }

  if (!user.phone_verified) {
    score += 20;
    flags.push("phone_unverified");
  }

  if (!user.id_verified) {
    score += 25;
    flags.push("id_unverified");
  }

  if (user.average_rating !== null && user.total_reviews > 0 && user.average_rating < 3) {
    score += 20;
    flags.push("low_rating");
  }

  const [damageClaims, theftReports, recentRentals] = await Promise.all([
    admin
      .from("disputes")
      .select("id, rentals!inner(renter_id)", { count: "exact", head: true })
      .eq("rentals.renter_id", user.id)
      .eq("dispute_type", "damage")
      .gte("created_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()),
    admin
      .from("disputes")
      .select("id, rentals!inner(renter_id)", { count: "exact", head: true })
      .eq("rentals.renter_id", user.id)
      .eq("dispute_type", "theft"),
    admin
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", user.id)
      .gte("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if ((damageClaims.count ?? 0) > 2) {
    score += 30;
    flags.push("high_damage_claims");
  }
  if ((theftReports.count ?? 0) > 1) {
    score += 40;
    flags.push("theft_reports");
  }
  if ((recentRentals.count ?? 0) > 5) {
    score += 20;
    flags.push("rapid_rentals");
  }

  const riskLevel: RiskLevel = score >= 80 ? "high" : score >= 40 ? "medium" : "low";

  if (riskLevel !== "low") {
    await admin.from("fraud_flags").insert(
      flags.map((rule) => ({
        user_id: user.id,
        rule,
        risk_level: riskLevel,
        details: `score=${score}`,
      }))
    );
  }

  return { riskLevel, score, flags };
}
