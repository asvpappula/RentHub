// Attacker simulation: log in as a normal user with the ANON key and try to
// forge trust fields and rental state directly via PostgREST. All must fail.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await c.auth.signInWithPassword({ email: "renter@renthub.test", password: "renthub-test-1234" });

const results = {};

// 1. Forge trust fields
{
  const { error } = await c.from("users").update({ id_verified: true, average_rating: 5, total_rentals: 999 }).eq("email", "renter@renthub.test");
  results.forge_trust = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
// 2. Forge rental state
{
  const { error } = await c.from("rentals").update({ status: "confirmed", total_cost: 0, deposit_status: "refunded" }).eq("id", 1);
  results.forge_rental = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
// 3. Insert a free confirmed rental
{
  const { error } = await c.from("rentals").insert({ renter_id: 2, owner_id: 1, item_id: 1, status: "confirmed", start_date: "2027-01-01", end_date: "2027-01-02", daily_rate: 0, number_of_days: 1, insurance_fee: 0, deposit_amount: 0, total_cost: 0 });
  results.insert_free_rental = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
// 4. Read other users' private columns
{
  const { data, error } = await c.from("users").select("email, phone_number, stripe_verification_session_id").neq("email", "renter@renthub.test");
  results.read_private = error ? `BLOCKED (${error.code ?? error.message})` : `rows=${data.length} (own-row policy → expect 0 others)`;
}
// 5. Self-approve an item's rating
{
  const { error } = await c.from("items").update({ average_rating: 5, view_count: 99999 }).eq("id", 1);
  results.forge_item = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
