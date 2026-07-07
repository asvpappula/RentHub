"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import {
  FiSend,
  FiMessageSquare,
  FiChevronLeft,
  FiArrowDown,
} from "react-icons/fi";
import type { Conversation, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { formatDateTime, cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/EmptyState";

// Survives navigation within the session — the list renders instantly
// on return and refreshes in the background.
let conversationsCache: Conversation[] | null = null;

function bubbleTime(iso: string) {
  return format(parseISO(iso), "h:mm a");
}

function dayLabel(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEEE");
  return format(d, "MMM d, yyyy");
}

function MessagesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get("user");

  const [conversations, setConversations] = useState<Conversation[]>(
    () => conversationsCache ?? []
  );
  const [loadingConvos, setLoadingConvos] = useState(conversationsCache === null);
  const [activeUserId, setActiveUserId] = useState<number | null>(
    initialUserId ? Number(initialUserId) : null
  );
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [draft, setDraft] = useState("");
  const [showJumpDown, setShowJumpDown] = useState(false);

  const {
    messages,
    loading: loadingMessages,
    sending,
    sendMessage,
    otherTyping,
    notifyTyping,
  } = useMessages(activeUserId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastMessageId = useRef<number | null>(null);

  const loadConversations = useCallback(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => {
        conversationsCache = data.conversations ?? [];
        setConversations(conversationsCache ?? []);
      })
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

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setShowJumpDown(false);
  };

  // Smart auto-scroll: follow new messages only when already near the bottom
  // (or when the newest message is your own). Otherwise offer a jump button.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastMessageId.current) return;
    const isFirstLoad = lastMessageId.current === null;
    lastMessageId.current = last.id;

    const mine = last.sender_id === user?.id;
    if (isFirstLoad || mine || nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: isFirstLoad ? "auto" : "smooth",
      });
    } else {
      setShowJumpDown(true);
    }
  }, [messages, user?.id]);

  // Reset scroll tracking when switching conversations.
  useEffect(() => {
    lastMessageId.current = null;
    nearBottomRef.current = true;
    setShowJumpDown(false);
  }, [activeUserId]);

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
            "relative flex min-w-0 flex-1 flex-col",
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
                <div>
                  <p className="font-semibold text-slate-900">
                    {activeUser?.name ?? "…"}
                  </p>
                  {otherTyping && (
                    <p className="text-xs font-medium text-primary-600">typing…</p>
                  )}
                </div>
              </div>

              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 space-y-2 overflow-y-auto px-5 py-4"
              >
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
                  messages.map((m, i) => {
                    const mine = m.sender_id === user?.id;
                    const prev = messages[i - 1];
                    const newDay =
                      !prev ||
                      dayLabel(prev.created_at) !== dayLabel(m.created_at);
                    return (
                      <div key={m.id}>
                        {newDay && (
                          <div className="my-3 flex items-center gap-3">
                            <span className="h-px flex-1 bg-slate-100" />
                            <span className="text-[11px] font-medium text-slate-400">
                              {dayLabel(m.created_at)}
                            </span>
                            <span className="h-px flex-1 bg-slate-100" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex",
                            mine ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            title={formatDateTime(m.created_at)}
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                              mine
                                ? "rounded-br-md bg-primary-500 text-white"
                                : "rounded-bl-md bg-slate-100 text-slate-800"
                            )}
                          >
                            <p className="whitespace-pre-line break-words">
                              {m.content}
                            </p>
                            <p
                              className={cn(
                                "mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none",
                                mine ? "text-primary-100/80" : "text-slate-400"
                              )}
                            >
                              {bubbleTime(m.created_at)}
                              {mine && (
                                <span
                                  title={m.read_at ? "Read" : "Sent"}
                                  className={cn(
                                    "text-[11px]",
                                    m.read_at
                                      ? "font-bold text-secondary-200"
                                      : "text-white/60"
                                  )}
                                >
                                  {m.read_at ? "✓✓" : "✓"}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* New-messages jump button */}
              {showJumpDown && (
                <button
                  onClick={() => {
                    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                    setShowJumpDown(false);
                  }}
                  className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/85 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-slate-900"
                >
                  <FiArrowDown className="h-3.5 w-3.5" />
                  New messages
                </button>
              )}

              <form
                onSubmit={submit}
                className="flex items-center gap-2 border-t border-slate-100 p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    notifyTyping();
                  }}
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
