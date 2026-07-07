"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Message } from "@/types";

/**
 * In-memory conversation cache (stale-while-revalidate): switching tabs,
 * conversations, or pages shows cached messages instantly while a background
 * fetch refreshes them. Realtime keeps it current in between.
 */
const messageCache = new Map<number, Message[]>();

/** Live conversation with another user. */
export function useMessages(otherUserId: number | null) {
  const { user } = useAuth();
  const [messages, setMessagesState] = useState<Message[]>(
    () => (otherUserId && messageCache.get(otherUserId)) || []
  );
  const [loading, setLoading] = useState(
    () => !(otherUserId && messageCache.has(otherUserId))
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Write-through: keep the cache in sync with every state update.
  const setMessages = useCallback(
    (update: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        if (otherUserId) messageCache.set(otherUserId, next);
        return next;
      });
    },
    [otherUserId]
  );

  useEffect(() => {
    if (!user || !otherUserId) {
      setMessagesState([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = messageCache.get(otherUserId);
    if (cached) {
      // Instant render from cache; refresh silently in the background.
      setMessagesState(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetch(`/api/messages/${otherUserId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else {
          messageCache.set(otherUserId, data.messages ?? []);
          setMessagesState(data.messages ?? []);
        }
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
          typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      cancelled = true;
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      setOtherTyping(false);
    };
  }, [user, otherUserId]);

  /** Broadcast that the current user is typing (throttled to ~1/sec),
   *  reusing the already-subscribed channel. */
  const notifyTyping = useCallback(() => {
    if (!user || !otherUserId || !typingChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1000) return;
    lastTypingSent.current = now;
    typingChannelRef.current.send({
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
