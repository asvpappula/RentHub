// Adds demo photos to seeded items that have none.
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

// Stable demo images (picsum seeds are deterministic).
const PHOTOS = {
  "DeWalt 20V Cordless Drill Kit": ["renthub-drill-1", "renthub-drill-2"],
  "Sony A7 III + 28-70mm Lens": [
    "renthub-camera-1",
    "renthub-camera-2",
    "renthub-camera-3",
  ],
  "6-Person Coleman Tent": ["renthub-tent-1", "renthub-tent-2"],
};

const { data: items } = await admin.from("items").select("id, title");

for (const item of items ?? []) {
  const seeds = PHOTOS[item.title];
  if (!seeds) continue;

  const { count } = await admin
    .from("item_photos")
    .select("id", { count: "exact", head: true })
    .eq("item_id", item.id);
  if ((count ?? 0) > 0) {
    console.log(`photos exist for: ${item.title}`);
    continue;
  }

  const rows = seeds.map((seed, i) => ({
    item_id: item.id,
    photo_url: `https://picsum.photos/seed/${seed}/800/600`,
    photo_type: i === 0 ? "main" : "gallery",
  }));
  const { error } = await admin.from("item_photos").insert(rows);
  if (error) throw error;
  console.log(`added ${rows.length} photos to: ${item.title}`);
}

console.log("PHOTOS OK");
