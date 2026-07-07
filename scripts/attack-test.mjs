// Simulates a malicious logged-in user hitting PostgREST directly with the
// public anon key. Every attack here must FAIL.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")