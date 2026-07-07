"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Message } from "@/types";

/**
 * In-memory conversation cache (stale-while-revalidate): switching tabs,
 * conversations, or pages shows cached messages instantly while a background
 * fetch refreshes them. Keyed by BOTH account and counterpart so switching
 * logins in the same browser never serves another account's thread.
 */
const messageCache = new Map<string, Message[]>();

/**
 * Shared, ref-counted typing channels.
 *
 * Both users must join the SAME topic to exchange typing broadcasts, but
 * re-subscribing a topic while its previous channel is being torn down
 * (React strict-mode remounts, conversation switches) races on the server
 * and leaves the new channel CLOSED. So each pair topic gets one long-lived
 * channel: hook instances register listeners, and teardown is delayed and
 * cancelled if the topic is re-acquired.
 */
interface TypingEntry {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<(from: number) => void>;
  refs: number;
  removeTimer: ReturnType<typeof setTimeout> | null;
}
const typingChannels = new Map<string, TypingEntry>();

function acquireTypingChannel(
  topic: string,
  listener: (from: number) => void
): { send: (from: number) => void; release: () => void } {
  let entry = typingChannels.get(topic);
  if (!entry) {
    const created: TypingEntry = {
      channel: supabase.channel(topic),
      listeners: new Set(),
      refs: 0,
      removeTimer: null,
    };
    created.channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const from = Number(payload?.from);
        created.listeners.forEach((l) => l(from));
      })
      .subscribe();
    typingChannels.set(topic, created);
    entry = created;
  }
  if (entry.removeTimer) {
    clearTimeout(entry.removeTimer);
    entry.removeTimer = null;
  }
  entry.listeners.add(listener);
  entry.refs += 1;

  return {
    send: (from: number) => {
      entry.channel.send({ type: "broadcast", event: "typing", payload: { from } });
    },
    release: () => {
      entry.listeners.delete(listener);
      entry.refs -= 1;
      if (entry.refs <= 0) {
        // Grace period dodges remount races and quick conversation switches.
        entry.removeTimer = setTimeout(() => {
          typingChannels.delete(topic);
          supabase.removeChannel(entry.channel);
        }, 10_000);
      }
    },
  };
}

/** Live conversation with another user. */
export function useMessages(otherUserId: number | null) {
  const { user } = useAuth();
  const [messages, setMessagesState] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const typingSendRef = useRef<((from: number) => void) | null>(null);

  const cacheKey = user && otherUserId ? `${user.id}:${otherUserId}` : null;

  // Write-through: keep the cache in sync with every state update.
  const setMessages = useCallback(
    (update: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        if (cacheKey) messageCache.set(cacheKey, next);
        return next;
      });
    },
    [cacheKey]
  );

  useEffect(() => {
    if (!user || !otherUserId) {
      setMessagesState([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = messageCache.get(`${user.id}:${otherUserId}`);
    if (cached) {
      // Instant render from cache; refresh silently in the background.
      setMessagesState(cached);
      setLoading(false);
    } else {
      setMessagesState([]);
      setLoading(true);
    }

    fetch(`/api/messages/${otherUserId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else {
          messageCache.set(`${user.id}:${otherUserId}`, data.messages ?? []);
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

    // Live inserts in either direction. Topic is unique per instance —
    // postgres_changes doesn't need a shared topic, and unique names avoid
    // same-topic subscription races on remount.
    const channel = supabase
      .channel(`messages:${user.id}:${otherUserId}:${Math.random().toString(36).slice(2)}`)
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

    // Typing indicator via the shared, ref-counted pair channel.
    const pair = [user.id, otherUserId].sort((a, b) => a - b).join(":");
    const typing = acquireTypingChannel(`typing:${pair}`, (from) => {
      if (from === otherUserId) {
        setOtherTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
      }
    });
    typingSendRef.current = typing.send;

    return () => {
      cancelled = true;
      typingSendRef.current = null;
      supabase.removeChannel(channel);
      typing.release();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      setOtherTyping(false);
    };
  }, [user, otherUserId]);

  /** Broadcast that the current user is typing (throttled to ~1/sec). */
  const notifyTyping = useCallback(() => {
    if (!user || !otherUserId || !typingSendRef.current) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1000) return;
    lastTypingSent.current = now;
    typingSendRef.current(user.id);
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
