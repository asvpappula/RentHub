// Phase 3 attacker simulation: admin_actions + email_events must be fully
// invisible/immutable to clients (deny-all RLS). is_admin must not be settable.
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

const r = {};
for (const t of ["admin_actions", "email_events"]) {
  const { data, error } = await c.from(t).select("*");
  r[`read_${t}`] = error ? `BLOCKED (${error.code ?? error.message})` : `rows=${data.length} (expect 0)`;
}
{
  const { error } = await c.from("admin_actions").insert({
    admin_user_id: 2, action_type: "x", target_type: "y",
  });
  r.forge_admin_action = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
{
  // Privilege escalation: try to make yourself admin.
  const { error } = await c.from("users").update({ is_admin: true }).eq("email", "renter@renthub.test");
  r.self_promote_admin = error ? `BLOCKED (${error.code ?? error.message})` : "!!! SUCCEEDED — HOLE";
}
console.log(JSON.stringify(r, null, 2));
process.exit(0);
