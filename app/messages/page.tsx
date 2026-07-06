"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { FiSend, FiMessageSquare, FiChevronLeft } from "react-icons/fi";
import type { Conversation, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { formatDateTime, cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/EmptyState";

function MessagesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get("user");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeUserId, setActiveUserId] = useState<number | null>(
    initialUserId ? Number(initialUserId) : null
  );
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [draft, setDraft] = useState("");

  const { messages, loading: loadingMessages, sending, sendMessage } =
    useMessages(activeUserId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations ?? []))
      .finally(() => setLoadingConvos(false));
  }, []);

  useEffect(loadConversations, [loadConversations]);

  // Resolve the counterpart's profile when deep-linked (?user=N).
  useEffect(() => {
    if (!activeUserId) {
      setActiveUser(null);
      return;
    }
    const known = conversations.find((c) => c.otherUser?.id === activeUserId);
    if (known?.otherUser) {
      setActiveUser(known.otherUser);
      return;
    }
    fetch(`/api/users/${activeUserId}`)
      .then((r) => r.json())
      .then((data) => setActiveUser(data.user ?? null));
  }, [activeUserId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    try {
      await sendMessage(text);
      loadConversations();
    } catch {
      setDraft(text);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-6 sm:py-8">
      <div className="flex h-[calc(100vh-9rem)] overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-slate-100 sm:shadow-sm">
        {/* Conversation list */}
        <aside
          className={cn(
            "w-full shrink-0 border-r border-slate-100 sm:w-80",
            activeUserId !== null && "hidden sm:block"
          )}
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <h1 className="text-lg font-bold text-slate-900">Messages</h1>
          </div>
          <div className="h-full overflow-y-auto pb-24">
            {loadingConvos ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : conversations.length === 0 && !activeUserId ? (
              <div className="p-4">
                <EmptyState
                  icon={<FiMessageSquare className="h-6 w-6" />}
                  title="No messages yet"
                  description="Message an owner from any item page to start a conversation."
                />
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.otherUser?.id}
                  onClick={() => setActiveUserId(c.otherUser?.id ?? null)}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50",
                    activeUserId === c.otherUser?.id && "bg-primary-50/60"
                  )}
                >
                  <Avatar
                    src={c.otherUser?.avatar_url}
                    name={c.otherUser?.name}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {c.otherUser?.name}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {c.lastMessage.sender_id === user?.id ? "You: " : ""}
                      {c.lastMessage.content}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Thread */}
        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            activeUserId === null && "hidden sm:flex"
          )}
        >
          {activeUserId === null ? (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              <div className="text-center">
                <FiMessageSquare className="mx-auto h-10 w-10" />
                <p className="mt-2 text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
                <button
                  onClick={() => setActiveUserId(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:hidden"
                  aria-label="Back"
                >
                  <FiChevronLeft className="h-5 w-5" />
                </button>
                <Avatar
                  src={activeUser?.avatar_url}
                  name={activeUser?.name}
                  size="sm"
                />
                <p className="font-semibold text-slate-900">
                  {activeUser?.name ?? "…"}
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {loadingMessages ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-2/3 rounded-2xl" />
                    <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                    <Skeleton className="h-10 w-1/2 rounded-2xl" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="pt-10 text-center text-sm text-slate-400">
                    Say hello 👋 — messages are delivered in real time.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                            mine
                              ? "rounded-br-md bg-primary-500 text-white"
                              : "rounded-bl-md bg-slate-100 text-slate-800"
                          )}
                        >
                          <p className="whitespace-pre-line break-words">{m.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              mine ? "text-primary-100" : "text-slate-400"
                            )}
                          >
                            {formatDateTime(m.created_at)}
                            {mine && m.read_at && " · Read"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={submit}
                className="flex items-center gap-2 border-t border-slate-100 p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm focus:border-primary-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-500 text-white transition hover:bg-primary-600 disabled:opacity-50"
                  aria-label="Send"
                >
                  <FiSend className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}
