"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks which users are currently online via a shared Supabase presence
 * channel. Returns the set of online user ids (including your own).
 */
export function usePresence(): Set<number> {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      setOnline(new Set());
      return;
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: String(user.id) } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState()).map(Number)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return online;
}
