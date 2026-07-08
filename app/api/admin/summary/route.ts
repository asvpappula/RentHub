import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin";

/** Queue counts for the admin dashboard. */
export async function GET() {
  try {
    const { admin } = await requireAdmin();

    const today = new Date().toISOString().slice(0, 10);
    const [
      openDisputes,
      openClaims,
      chargebacks,
      heldPayouts,
      failedPayouts,
      webhookFailures,
      fraudFlags,
      suspendedUsers,
      hiddenListings,
      openIncidents,
      lateRentals,
    ] = await Promise.all([
      admin.from("disputes").select("id", { count: "exact", head: true })
        .in("status", ["pending", "under_review", "appealed"]),
      admin.from("insurance_claims").select("id", { count: "exact", head: true })
        .in("status", ["pending", "under_review"]),
      admin.from("payments").select("id", { count: "exact", head: true })
        .eq("dispute_status", "disputed"),
      admin.from("payouts").select("id", { count: "exact", head: true })
        .in("status", ["pending", "releasing", "blocked"]),
      admin.from("payouts").select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      admin.from("webhook_events").select("event_id", { count: "exact", head: true })
        .eq("status", "error").is("reviewed_at", null),
      admin.from("fraud_flags").select("id", { count: "exact", head: true })
        .eq("risk_level", "high"),
      admin.from("users").select("id", { count: "exact", head: true })
        .eq("suspended", true),
      admin.from("items").select("id", { count: "exact", head: true })
        .eq("hidden", true),
      admin.from("incidents").select("id", { count: "exact", head: true })
        .in("status", ["open", "under_review", "awaiting_evidence"]),
      admin.from("rentals").select("id", { count: "exact", head: true })
        .eq("status", "active").lt("end_date", today).in("return_status", ["none", "issue"]),
    ]);

    return NextResponse.json({
      summary: {
        openDisputes: openDisputes.count ?? 0,
        openClaims: openClaims.count ?? 0,
        chargebacks: chargebacks.count ?? 0,
        heldPayouts: heldPayouts.count ?? 0,
        failedPayouts: failedPayouts.count ?? 0,
        webhookFailures: webhookFailures.count ?? 0,
        fraudFlags: fraudFlags.count ?? 0,
        suspendedUsers: suspendedUsers.count ?? 0,
        hiddenListings: hiddenListings.count ?? 0,
        openIncidents: openIncidents.count ?? 0,
        lateRentals: lateRentals.count ?? 0,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
