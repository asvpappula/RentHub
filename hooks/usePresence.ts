"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Singleton presence channel per logged-in user. Presence requires a shared
 * topic, and re-subscribing the same topic on remount races the previous
 * teardown — so the channel lives for the session (torn down only when the
 * account changes) and hook instances just register listeners.
 */
let presenceUserId: number | null = null;
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let currentOnline = new Set<number>();
const presenceListeners = new Set<(online: Set<number>) => void>();

function ensurePresence(userId: number) {
  if (presenceChannel && presenceUserId === userId) return;
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
  presenceUserId = userId;
  const channel = supabase.channel("online-users", {
    config: { presence: { key: String(userId) } },
  });
  presenceChannel = channel;
  channel
    .on("presence", { event: "sync" }, () => {
      currentOnline = new Set(Object.keys(channel.presenceState()).map(Number));
      presenceListeners.forEach((l) => l(currentOnline));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
}

/** Returns the set of online user ids (including your own). */
export function usePresence(): Set<number> {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<number>>(currentOnline);

  useEffect(() => {
    if (!user) {
      setOnline(new Set());
      return;
    }
    ensurePresence(user.id);
    setOnline(currentOnline);
    const listener = (next: Set<number>) => setOnline(new Set(next));
    presenceListeners.add(listener);
    return () => {
      presenceListeners.delete(listener);
    };
  }, [user]);

  return online;
}
