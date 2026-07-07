import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const key = `test-${Date.now()}`;
const results = [];
for (let i = 0; i < 5; i++) {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_limit: 3,
    p_window_seconds: 60,
  });
  results.push(error ? `ERR: ${error.message}` : data);
}
console.log("limit=3 over 5 calls →", JSON.stringify(results));
console.log(
  results.slice(0, 3).every((r) => r === true) && results.slice(3).every((r) => r === false)
    ? "RATE LIMIT WORKS (true,true,true,false,false)"
    : "!!! UNEXPECTED"
);
process.exit(0);
