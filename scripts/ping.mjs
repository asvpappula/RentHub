// Sends a one-off message from Ryan (2) to Olivia (1) for realtime testing.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await admin
  .from("messages")
  .insert({ sender_id: 2, recipient_id: 1, content: process.argv[2] ?? "ping" })
  .select("id")
  .single();
console.log(error ?? `sent #${data.id}`);
