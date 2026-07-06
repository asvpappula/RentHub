"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiCalendar,
  FiClock,
  FiArchive,
  FiBell,
  FiPackage,
  FiDollarSign,
  FiStar,
  FiTrash2,
} from "react-icons/fi";
import type { Rental } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { formatMoney, formatDateTime, cn } from "@/lib/utils";
import RentalCard from "@/components/RentalCard";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";

export default function RenterDashboard() {
  const { user } = useAuth();
  const { notifications, markAsRead, deleteNotification } = useNotifications();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rentals?role=renter")
      .then((r) => r.json())
      .then((data) => setRentals(data.rentals ?? []))
      .finally(() => setLoading(false));
  }, []);

  const active = rentals.filter((r) => ["confirmed", "active"].includes(r.status));
  const upcoming = rentals.filter((r) => ["pending", "approved"].includes(r.status));
  const past = rentals.filter((r) =>
    ["completed", "rejected", "cancelled", "disputed"].includes(r.status)
  );
  const totalSpent = rentals
    .filter((r) => ["confirmed", "active", "completed"].includes(r.status))
    .reduce((sum, r) => sum + (r.total_cost - r.deposit_amount), 0);

  const stats = [
    { icon: FiDollarSign, label: "Total spent", value: formatMoney(totalSpent) },
    { icon: FiPackage, label: "Items rented", value: String(rentals.length) },
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
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your rentals.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/browse">
            <Button variant="outline">Browse items</Button>
          </Link>
          <Link href="/owner/dashboard">
            <Button variant="secondary">Owner dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
          >
            <s.icon className="h-5 w-5 text-primary-600" />
            <p className="mt-2 text-lg font-bold text-slate-900 sm:text-2xl">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Active */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FiClock className="h-5 w-5 text-primary-600" /> Active rentals
            </h2>
            <div className="mt-3 space-y-3">
              {loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : active.length === 0 ? (
                <EmptyState
                  icon={<FiClock className="h-6 w-6" />}
                  title="No active rentals"
                  description="Items you're currently renting will show up here."
                  action={
                    <Link href="/browse">
                      <Button size="sm">Find something to rent</Button>
                    </Link>
                  }
                />
              ) : (
                active.map((r) => (
                  <RentalCard key={r.id} rental={r} perspective="renter" />
                ))
              )}
            </div>
          </section>

          {/* Upcoming */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FiCalendar className="h-5 w-5 text-secondary-600" /> Upcoming & pending
            </h2>
            <div className="mt-3 space-y-3">
              {loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-slate-400">No upcoming rentals.</p>
              ) : (
                upcoming.map((r) => (
                  <RentalCard key={r.id} rental={r} perspective="renter" />
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
                <p className="text-sm text-slate-400">Your rental history will appear here.</p>
              ) : (
                past.slice(0, 5).map((r) => (
                  <RentalCard key={r.id} rental={r} perspective="renter" />
                ))
              )}
            </div>
          </section>
        </div>

        {/* Notifications */}
        <aside>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FiBell className="h-5 w-5 text-amber-500" /> Notifications
          </h2>
          <div className="mt-3 space-y-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400">You&apos;re all caught up.</p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group rounded-xl border p-3.5 transition",
                    n.read_at
                      ? "border-slate-100 bg-white"
                      : "border-primary-200 bg-primary-50/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="flex-1 text-left"
                      onClick={() => !n.read_at && markAsRead(n.id)}
                    >
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDateTime(n.created_at)}
                      </p>
                    </button>
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                      aria-label="Delete notification"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {n.related_rental_id && (
                    <Link
                      href={`/rental/${n.related_rental_id}`}
                      className="mt-1.5 inline-block text-xs font-semibold text-primary-600 hover:underline"
                    >
                      View rental →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
