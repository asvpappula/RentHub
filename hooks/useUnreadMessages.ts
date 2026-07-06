"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/** Live count of unread messages for the current user (navbar badge). */
export function useUnreadMessages() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`unread-messages:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        fetchCount
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        fetchCount
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // pathname dependency: re-check after navigating (e.g. leaving a thread).
  }, [user, pathname]);

  return count;
}
