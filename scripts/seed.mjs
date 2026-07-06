// Seeds two confirmed test users and sample items via the service-role key.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("C:/Users/pappu/RentHub/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function ensureUser(email, name) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "renthub-test-1234",
    email_confirm: true,
    user_metadata: { name },
  });
  if (error && !String(error.message).includes("already")) throw error;
  const authId = data?.user?.id;
  // Profile row is created by the on_auth_user_created trigger.
  const { data: profile } = await admin
    .from("users")
    .select("id, email, name")
    .eq("email", email)
    .single();
  return { authId, profile };
}

const owner = await ensureUser("owner@renthub.test", "Olivia Owner");
const renter = await ensureUser("renter@renthub.test", "Ryan Renter");
console.log("owner profile:", owner.profile);
console.log("renter profile:", renter.profile);

const items = [
  {
    owner_id: owner.profile.id,
    category: "Tools & DIY",
    title: "DeWalt 20V Cordless Drill Kit",
    description:
      "Barely used DeWalt drill with 2 batteries, charger, and a 30-piece bit set. Perfect for weekend projects.",
    condition: "like_new",
    daily_rate: 12,
    deposit_amount: 60,
    delivery_options: "Pickup",
  },
  {
    owner_id: owner.profile.id,
    category: "Cameras & Photography",
    title: "Sony A7 III + 28-70mm Lens",
    description:
      "Full-frame mirrorless camera, great for events and portraits. Comes with 2 batteries and a 128GB SD card.",
    condition: "good",
    daily_rate: 45,
    deposit_amount: 400,
    gps_tracking_required: true,
    delivery_options: "Pickup, Owner drop-off",
  },
  {
    owner_id: owner.profile.id,
    category: "Outdoor & Camping",
    title: "6-Person Coleman Tent",
    description: "Spacious weatherproof tent, sets up in 10 minutes. Includes stakes and rainfly.",
    condition: "good",
    daily_rate: 15,
    deposit_amount: 50,
    delivery_options: "Pickup",
  },
];

for (const item of items) {
  const { data: existing } = await admin
    .from("items")
    .select("id")
    .eq("title", item.title)
    .maybeSingle();
  if (existing) {
    console.log("item exists:", item.title);
    continue;
  }
  const { data, error } = await admin.from("items").insert(item).select("id, title").single();
  if (error) throw error;
  console.log("created item:", data);
}

console.log("SEED OK");
