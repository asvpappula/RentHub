import type { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { User } from "@/types";

export type RiskLevel = "low" | "medium" | "high";

interface FraudResult {
  riskLevel: RiskLevel;
  flags: string[];
}

/**
 * Rule-based fraud screening run before a rental request is accepted.
 * Flags are recorded in fraud_flags; high risk blocks the request.
 */
export async function checkFraudRisk(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  user: User
): Promise<FraudResult> {
  const flags: string[] = [];
  const now = Date.now();

  const accountAgeDays =
    (now - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 7) flags.push("new_account");

  const { count: recentRentals } = await admin
    .from("rentals")
    .select("id", { count: "exact", head: true })
    .eq("renter_id", user.id)
    .gte("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
  if ((recentRentals ?? 0) > 5) flags.push("rapid_rentals");

  if (user.average_rating !== null && user.total_reviews > 0 && user.average_rating < 3)
    flags.push("low_rating");

  const { count: recentDisputes } = await admin
    .from("disputes")
    .select("id, rentals!inner(renter_id)", { count: "exact", head: true })
    .eq("rentals.renter_id", user.id)
    .eq("dispute_type", "damage")
    .gte("created_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());
  if ((recentDisputes ?? 0) > 2) flags.push("high_damage_claims");

  const riskLevel: RiskLevel =
    flags.length >= 3 ? "high" : flags.length >= 2 ? "medium" : "low";

  if (flags.length > 0) {
    await admin.from("fraud_flags").insert(
      flags.map((rule) => ({
        user_id: user.id,
        rule,
        risk_level: riskLevel,
      }))
    );
  }

  return { riskLevel, flags };
}
