// Attacker simulation for Phase 2 financial tables: a logged-in user with the
// ANON key must NOT be able to read or write connected_accounts / payments /
// payouts / refunds. All should be blocked (deny-all RLS + revoked writes).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await c.auth.signInWithPassword({ email: "owner@renthub.test", password: "renthub-test-1234" });

const results = {};

// Reads must return 0 rows (RLS deny-all → no policy grants SELECT).
for (const t of ["connected_accounts", "payments", "payouts", "refunds"]) {
  const { data, error } = await c.from(t).select("*");
  results[`read_${t}`] = error
    ? `BLOCKED (${error.code ?? error.message})`
    : `rows=${data.length} (expect 0)`;
}

// Forge a payout as transferred (theft attempt) — must be blocked.
{
  const { error } = await c.from("payouts").update({ status: "transferred" }).eq("rental_id", 13);
  results.forge_payout_status = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
// Forge a connected account as onboarded — must be blocked.
{
  const { error } = await c.from("connected_accounts")
    .update({ onboarding_complete: true, payouts_enabled: true }).eq("user_id", 1);
  results.forge_connected_account = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
// Insert a fake payment — must be blocked.
{
  const { error } = await c.from("payments").insert({
    rental_id: 13, renter_id: 2, owner_id: 1, item_id: 2,
    amount_cents: 1, platform_fee_cents: 0, owner_payout_cents: 1,
  });
  results.insert_fake_payment = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
