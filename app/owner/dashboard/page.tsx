"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FiPlusCircle,
  FiInbox,
  FiClock,
  FiArchive,
  FiDollarSign,
  FiPackage,
  FiStar,
  FiCheck,
  FiX,
  FiEdit2,
} from "react-icons/fi";
import { isAfter, parseISO, startOfMonth, startOfYear } from "date-fns";
import type { Item, Rental } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { formatMoney, formatDate } from "@/lib/utils";
import RentalCard from "@/components/RentalCard";
import EmptyState from "@/components/EmptyState";
import VerificationBadges from "@/components/VerificationBadges";
import TrustScore from "@/components/TrustScore";
import Modal from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { trustLevel, trustScore } from "@/lib/trust";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Rental | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [togglingItem, setTogglingItem] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/rentals?role=owner").then((r) => r.json()),
      user
        ? fetch(`/api/items?ownerId=${user.id}`).then((r) => r.json())
        : Promise.resolve({ items: [] }),
    ])
      .then(([rentalData, itemData]) => {
        setRentals(rentalData.rentals ?? []);
        setItems(itemData.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(load, [load]);

  const requests = rentals.filter((r) => r.status === "pending");
  const active = rentals.filter((r) => ["confirmed", "active"].includes(r.status));
  const past = rentals.filter((r) =>
    ["completed", "disputed", "cancelled", "rejected"].includes(r.status)
  );

  const earningRentals = rentals.filter((r) =>
    ["confirmed", "active", "completed"].includes(r.status)
  );
  // Owner earns the rental rate net of the 15% platform commission
  // (insurance fee and deposit are not owner revenue).
  const earningsOf = (list: Rental[]) =>
    Math.round(
      list.reduce((sum, r) => sum + r.daily_rate * r.number_of_days * 0.85, 0)
    );
  const totalEarnings = earningsOf(earningRentals);
  const monthEarnings = earningsOf(
    earningRentals.filter((r) => isAfter(parseISO(r.created_at), startOfMonth(new Date())))
  );
  const yearEarnings = earningsOf(
    earningRentals.filter((r) => isAfter(parseISO(r.created_at), startOfYear(new Date())))
  );

  const decide = async (
    rentalId: number,
    action: "approve" | "reject",
    reason?: string
  ) => {
    setActing(rentalId);
    try {
      const res = await fetch(`/api/rentals/${rentalId}/${action}`, {
        method: "POST",
        ...(action === "reject"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: reason || undefined }),
            }
          : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast(
        "success",
        action === "approve" ? "Request approved — renter can now pay." : "Request declined."
      );
      setRejecting(null);
      setRejectReason("");
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  /** Toggle a listing between available and archived (hidden from Browse). */
  const toggleArchive = async (item: Item) => {
    setTogglingItem(item.id);
    try {
      const next =
        item.availability_status === "unavailable" ? "available" : "unavailable";
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability_status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, availability_status: next } : i
        )
      );
      toast(
        "success",
        next === "unavailable"
          ? "Listing archived — hidden from Browse."
          : "Listing is live again."
      );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setTogglingItem(null);
    }
  };

  const totalViews = items.reduce((sum, i) => sum + (i.view_count ?? 0), 0);
  const totalItemRentals = items.reduce((sum, i) => sum + (i.rental_count ?? 0), 0);
  const mostPopular = [...items].sort(
    (a, b) => b.rental_count - a.rental_count || b.view_count - a.view_count
  )[0];

  const stats = [
    {
      icon: FiDollarSign,
      label: "Total earned (after 15% fee)",
      value: formatMoney(totalEarnings),
    },
    { icon: FiClock, label: "This month", value: formatMoney(monthEarnings) },
    { icon: FiArchive, label: "This year", value: formatMoney(yearEarnings) },
    { icon: FiPackage, label: "Items listed", value: String(items.length) },
    {
      icon: FiStar,
      label: "Your rating",
      value: user?.average_rating ? Number(user.average_rating).toFixed(1) : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Owner dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your listings, requests, and earnings.
          </p>
        </div>
        <Link href="/owner/list-item">
          <Button>
            <FiPlusCircle className="h-4 w-4" />
            List new item
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <s.icon className="h-5 w-5 text-primary-600" />
            <p className="mt-2 text-lg font-bold text-slate-900 sm:text-xl">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Analytics */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl bg-slate-50 px-5 py-3 text-sm text-slate-600">
        <span>
          <span className="font-semibold text-slate-900">{totalViews}</span> total views
        </span>
        <span>
          <span className="font-semibold text-slate-900">{totalItemRentals}</span> completed rentals
        </span>
        {mostPopular && (
          <span>
            Most popular:{" "}
            <Link
              href={`/item/${mostPopular.id}`}
              className="font-semibold text-primary-700 hover:underline"
            >
              {mostPopular.title}
            </Link>{" "}
            ({mostPopular.rental_count} rentals · {mostPopular.view_count} views)
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Incoming requests */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FiInbox className="h-5 w-5 text-amber-500" /> Incoming requests
              {requests.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {requests.length}
                </span>
              )}
            </h2>
            <div className="mt-3 space-y-3">
              {loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : requests.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No pending requests — new ones appear here instantly.
                </p>
              ) : (
                requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={r.renter?.avatar_url}
                        name={r.renter?.name}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900">
                          <Link
                            href={`/profile/${r.renter?.id}`}
                            className="font-semibold hover:text-primary-700"
                          >
                            {r.renter?.name}
                          </Link>{" "}
                          wants to rent{" "}
                          <Link
                            href={`/rental/${r.id}`}
                            className="font-semibold text-primary-700 hover:underline"
                          >
                            {r.item?.title}
                          </Link>
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(r.start_date)} → {formatDate(r.end_date)} ·{" "}
                          {formatMoney(r.total_cost - r.deposit_amount)} to you
                        </p>
                        {r.renter && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <VerificationBadges user={r.renter} />
                            {trustLevel(trustScore(r.renter)) === "low" && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                ⚠ Unverified renter
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {r.renter && <TrustScore user={r.renter} size="sm" />}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          loading={acting === r.id}
                          onClick={() => decide(r.id, "approve")}
                        >
                          <FiCheck className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acting === r.id}
                          onClick={() => setRejecting(r)}
                        >
                          <FiX className="h-4 w-4" /> Decline
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Active rentals */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FiClock className="h-5 w-5 text-primary-600" /> Active rentals
            </h2>
            <div className="mt-3 space-y-3">
              {loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : active.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing rented out right now.</p>
              ) : (
                active.map((r) => (
                  <RentalCard key={r.id} rental={r} perspective="owner" />
                ))
              )}
            </div>
          </section>

          {/* Past */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FiArchive className="h-5 w-5 text-slate-400" /> Past rentals
            </h2>
            <div className="mt-3 space-y-3">
              {loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : past.length === 0 ? (
                <p className="text-sm text-slate-400">Completed rentals appear here.</p>
              ) : (
                past.slice(0, 5).map((r) => (
                  <RentalCard key={r.id} rental={r} perspective="owner" />
                ))
              )}
            </div>
          </section>
        </div>

        {/* My listings */}
        <aside>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FiPackage className="h-5 w-5 text-secondary-600" /> My listings
          </h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <Skeleton className="h-40 w-full rounded-2xl" />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<FiPackage className="h-6 w-6" />}
                title="No listings yet"
                description="Turn your idle stuff into income."
                action={
                  <Link href="/owner/list-item">
                    <Button size="sm">List your first item</Button>
                  </Link>
                }
              />
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-primary-200"
                >
                  <Link
                    href={`/item/${item.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.photos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photos[0].photo_url}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-300">
                          <FiPackage className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatMoney(item.daily_rate)}/day · {item.rental_count} rentals ·{" "}
                        {item.view_count} views
                      </p>
                    </div>
                  </Link>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.availability_status === "available"
                        ? "bg-primary-500"
                        : "bg-slate-300"
                    }`}
                    title={item.availability_status}
                  />
                  <button
                    onClick={() => toggleArchive(item)}
                    disabled={
                      togglingItem === item.id ||
                      item.availability_status === "rented"
                    }
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-amber-600 disabled:opacity-40"
                    title={
                      item.availability_status === "rented"
                        ? "Currently rented"
                        : item.availability_status === "unavailable"
                          ? "Unarchive (show in Browse)"
                          : "Archive (hide from Browse)"
                    }
                    aria-label={`Archive ${item.title}`}
                  >
                    <FiArchive className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/owner/items/${item.id}/edit`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-primary-600"
                    aria-label={`Edit ${item.title}`}
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Decline-with-reason modal */}
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Decline this request?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={acting === rejecting?.id}
              onClick={() => rejecting && decide(rejecting.id, "reject", rejectReason)}
            >
              Decline request
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">
          {rejecting?.renter?.name} will be notified that their request for
          &ldquo;{rejecting?.item?.title}&rdquo; was declined.
        </p>
        <div className="mt-4">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional) — shared with the renter"
          />
        </div>
      </Modal>
    </div>
  );
}
