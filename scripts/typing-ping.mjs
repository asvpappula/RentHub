// Broadcasts a typing event as user 1 (Olivia) on the 1:2 pair channel —
// used to verify the cross-client typing indicator.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const channel = client.channel("typing:1:2");
await new Promise((resolve, reject) => {
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") resolve();
    if (status === "CHANNEL_ERROR") reject(new Error("channel error"));
  });
});

// A few pulses, like someone actively typing.
for (let i = 0; i < 20; i++) {
  await channel.send({
    type: "broadcast",
    event: "typing",
    payload: { from: 1 },
  });
  console.log("typing pulse", i + 1);
  await new Promise((r) => setTimeout(r, 900));
}

await client.removeChannel(channel);
process.exit(0);
