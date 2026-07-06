"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiShield } from "react-icons/fi";
import type { Dispute } from "@/types";
import { formatDateTime, cn } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/EmptyState";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  under_review: "bg-secondary-50 text-secondary-700 ring-secondary-200",
  resolved: "bg-primary-50 text-primary-700 ring-primary-200",
  appealed: "bg-rose-50 text-rose-700 ring-rose-200",
};

const FILTERS = ["all", "pending", "under_review", "resolved", "appealed"] as const;

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    fetch("/api/disputes")
      .then((r) => r.json())
      .then((data) => setDisputes(data.disputes ?? []))
      .finally(() => setLoading(false));
  }, []);

  const visible =
    filter === "all" ? disputes : disputes.filter((d) => d.status === filter);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Disputes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Damage and theft reports on your rentals, as renter or owner.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              filter === f
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-slate-200 text-slate-600 hover:border-primary-300"
            )}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<FiShield className="h-6 w-6" />}
            title="No disputes"
            description="Hopefully it stays that way! Reports filed from a rental page appear here."
          />
        ) : (
          visible.map((d) => (
            <Link
              key={d.id}
              href={`/disputes/${d.id}`}
              className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <FiAlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {d.dispute_type === "theft" ? "Theft" : d.dispute_type === "damage" ? "Damage" : "Issue"}{" "}
                  · {d.rental?.item?.title ?? `Rental #${d.rental_id}`}
                </p>
                <p className="line-clamp-1 text-sm text-slate-500">{d.description}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Filed by {d.reporter?.name} · {formatDateTime(d.created_at)}
                </p>
              </div>
              <Badge className={STATUS_STYLE[d.status]}>
                {d.status.replace("_", " ")}
              </Badge>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
