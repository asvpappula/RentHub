"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Message } from "@/types";

/** Live conversation with another user. */
export function useMessages(otherUserId: number | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!user || !otherUserId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/messages/${otherUserId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setMessages(data.messages ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });

    // Live inserts in either direction.
    const channel = supabase
      .channel(`messages:${user.id}:${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === otherUserId) {
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m]
            );
            fetch(`/api/messages/${m.id}/read`, { method: "PUT" });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${user.id}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        }
      )
      .subscribe();

    // Typing indicator via a shared broadcast channel for this user pair.
    const pair = [user.id, otherUserId].sort((a, b) => a - b).join(":");
    const typingChannel = supabase
      .channel(`typing:${pair}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.from === otherUserId) {
          setOtherTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setOtherTyping(false), 2500);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      setOtherTyping(false);
    };
  }, [user, otherUserId]);

  /** Broadcast that the current user is typing (throttled to ~1/sec). */
  const notifyTyping = useCallback(() => {
    if (!user || !otherUserId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1000) return;
    lastTypingSent.current = now;
    const pair = [user.id, otherUserId].sort((a, b) => a - b).join(":");
    supabase.channel(`typing:${pair}`).send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id },
    });
  }, [user, otherUserId]);

  const sendMessage = useCallback(
    async (content: string, rentalId?: number) => {
      if (!otherUserId || !content.trim()) return;
      setSending(true);
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_id: otherUserId,
            content: content.trim(),
            rental_id: rentalId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to send");
        setMessages((prev) => [...prev, data.message]);
      } finally {
        setSending(false);
      }
    },
    [otherUserId]
  );

  return { messages, loading, error, sending, sendMessage, otherTyping, notifyTyping };
}
