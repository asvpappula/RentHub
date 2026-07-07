"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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
  FiSearch,
  FiInfo,
  FiImage,
  FiCalendar,
} from "react-icons/fi";
import type { Conversation, Rental, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { usePresence } from "@/hooks/usePresence";
import { formatDate, formatDateTime, formatMoney, cn, STATUS_STYLES } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/EmptyState";

// Survives navigation within the session — the list renders instantly
// on return and refreshes in the background.
let conversationsCache: Conversation[] | null = null;
let rentalsCache: Rental[] | null = null;

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
  const online = usePresence();

  const [conversations, setConversations] = useState<Conversation[]>(
    () => conversationsCache ?? []
  );
  const [loadingConvos, setLoadingConvos] = useState(conversationsCache === null);
  const [rentals, setRentals] = useState<Rental[]>(() => rentalsCache ?? []);
  const [activeUserId, setActiveUserId] = useState<number | null>(
    initialUserId ? Number(initialUserId) : null
  );
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showJumpDown, setShowJumpDown] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

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
    fetch("/api/rentals")
      .then((r) => r.json())
      .then((data) => {
        rentalsCache = data.rentals ?? [];
        setRentals(rentalsCache ?? []);
      });
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

  // The most recent rental connecting me and the active user → details rail.
  const relatedRental = useMemo(() => {
    if (!activeUserId || !user) return null;
    return (
      rentals.find(
        (r) =>
          (r.renter_id === activeUserId && r.owner_id === user.id) ||
          (r.owner_id === activeUserId && r.renter_id === user.id)
      ) ?? null
    );
  }, [rentals, activeUserId, user]);

  const visibleConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.otherUser?.name?.toLowerCase().includes(q) ||
        c.lastMessage.content.toLowerCase().includes(q)
    );
  }, [conversations, search]);

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

  const isOnline = activeUserId !== null && online.has(activeUserId);

  return (
    <div className="flex h-[calc(100dvh-9rem)] w-full bg-white md:h-[calc(100dvh-4rem)]">
      {/* Conversation list */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-slate-100 sm:w-72 lg:w-80",
          activeUserId !== null && "hidden sm:flex"
        )}
      >
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h1 className="text-lg font-bold text-slate-900">Messages</h1>
          <div className="relative mt-2.5">
            <FiSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search within messages"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : visibleConversations.length === 0 && !activeUserId ? (
            <div className="p-4">
              <EmptyState
                icon={<FiMessageSquare className="h-6 w-6" />}
                title={search ? "No matches" : "No messages yet"}
                description={
                  search
                    ? "Try a different search."
                    : "Message an owner from any item page to start a conversation."
                }
              />
            </div>
          ) : (
            visibleConversations.map((c) => {
              const otherId = c.otherUser?.id;
              return (
                <button
                  key={otherId}
                  onClick={() => setActiveUserId(otherId ?? null)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                    activeUserId === otherId && "bg-primary-50/60"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      src={c.otherUser?.avatar_url}
                      name={c.otherUser?.name}
                      size="md"
                    />
                    {otherId !== undefined && online.has(otherId) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {c.otherUser?.name}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {bubbleTime(c.lastMessage.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-500">
                        {c.lastMessage.sender_id === user?.id ? "You: " : ""}
                        {c.lastMessage.content}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
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
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <button
                onClick={() => setActiveUserId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:hidden"
                aria-label="Back"
              >
                <FiChevronLeft className="h-5 w-5" />
              </button>
              <Link href={`/profile/${activeUserId}`} className="shrink-0">
                <Avatar
                  src={activeUser?.avatar_url}
                  name={activeUser?.name}
                  size="sm"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${activeUserId}`}
                  className="font-semibold text-slate-900 hover:text-primary-700"
                >
                  {activeUser?.name ?? "…"}
                </Link>
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    isOnline ? "text-primary-600" : "text-slate-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isOnline ? "bg-primary-500" : "bg-slate-300"
                    )}
                  />
                  {isOnline ? "Online" : "Offline"}
                </p>
              </div>
              {relatedRental && (
                <button
                  onClick={() => setDetailsOpen((v) => !v)}
                  className={cn(
                    "rounded-lg p-2 transition hover:bg-slate-50",
                    detailsOpen ? "text-primary-600" : "text-slate-400"
                  )}
                  aria-label="Toggle rental details"
                  title="Rental details"
                >
                  <FiInfo className="h-5 w-5" />
                </button>
              )}
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 space-y-2 overflow-y-auto bg-slate-50/40 px-4 py-4 lg:px-8"
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
                    !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-3 flex items-center gap-3">
                          <span className="h-px flex-1 bg-slate-200/70" />
                          <span className="text-[11px] font-medium text-slate-400">
                            {dayLabel(m.created_at)}
                          </span>
                          <span className="h-px flex-1 bg-slate-200/70" />
                        </div>
                      )}
                      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className="max-w-[75%]">
                          <div
                            title={formatDateTime(m.created_at)}
                            className={cn(
                              "rounded-2xl border px-4 py-2 text-sm text-slate-800",
                              mine
                                ? "rounded-br-md border-primary-100 bg-primary-50"
                                : "rounded-bl-md border-slate-200 bg-white"
                            )}
                          >
                            <p className="whitespace-pre-line break-words">{m.content}</p>
                          </div>
                          <p
                            className={cn(
                              "mt-1 flex items-center gap-1 text-[10px] text-slate-400",
                              mine ? "justify-end" : "justify-start"
                            )}
                          >
                            {bubbleTime(m.created_at)}
                            {mine && (
                              <span
                                title={m.read_at ? "Read" : "Sent"}
                                className={cn(
                                  "text-[11px]",
                                  m.read_at
                                    ? "font-bold text-secondary-500"
                                    : "text-slate-400"
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

              {/* Typing indicator as a chat bubble */}
              {otherTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      {activeUser?.name?.split(" ")[0] ?? "…"} is typing
                      <span className="flex gap-0.5">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-1 w-1 animate-bounce rounded-full bg-slate-400"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                    </span>
                  </div>
                </div>
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
              className="flex items-center gap-2 border-t border-slate-100 bg-white p-3"
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

      {/* Rental details rail */}
      {activeUserId !== null && relatedRental && detailsOpen && (
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-100 p-5 lg:flex">
          <h2 className="text-sm font-semibold text-slate-900">Rental Details</h2>
          <Link
            href={`/item/${relatedRental.item_id}`}
            className="mt-3 block overflow-hidden rounded-xl bg-slate-100"
          >
            {relatedRental.item?.photos?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={relatedRental.item.photos[0].photo_url}
                alt={relatedRental.item?.title ?? "Item"}
                className="aspect-[4/3] w-full object-cover transition hover:scale-105"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-slate-300">
                <FiImage className="h-10 w-10" />
              </div>
            )}
          </Link>
          <p className="mt-3 font-semibold text-slate-900">
            {relatedRental.item?.title}
          </p>
          <p className="text-sm text-slate-500">
            <span className="font-bold text-slate-900">
              {formatMoney(relatedRental.daily_rate)}
            </span>
            /day
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-xs font-medium text-slate-400">Booking dates</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-slate-700">
              <FiCalendar className="h-3.5 w-3.5 text-slate-400" />
              {formatDate(relatedRental.start_date)} –{" "}
              {formatDate(relatedRental.end_date)}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Status</span>
            <Badge className={STATUS_STYLES[relatedRental.status]}>
              {relatedRental.status}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Total</span>
            <span className="font-semibold text-slate-900">
              {formatMoney(relatedRental.total_cost)}
            </span>
          </div>
          <Link
            href={`/rental/${relatedRental.id}`}
            className="mt-4 rounded-xl bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-600"
          >
            View rental
          </Link>
          <Link
            href={`/rental/${relatedRental.id}/agreement`}
            className="mt-2 rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Rental agreement
          </Link>
        </aside>
      )}
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
