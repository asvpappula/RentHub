"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiShield, FiUmbrella } from "react-icons/fi";
import type { InsuranceClaim } from "@/types";
import { formatDateTime, formatMoney, cn } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/EmptyState";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-primary-50 text-primary-700 ring-primary-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/claims")
      .then((r) => r.json())
      .then((data) => setClaims(data.claims ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Protection claims</h1>
      <p className="mt-1 text-sm text-slate-500">
        RentHub damage protection covers accidental damage, theft, and loss up
        to $500 per rental, subject to review. Claims are reviewed by the
        RentHub team; approved compensation is applied through the rental
        deposit. This is platform protection, not a guaranteed insurance policy.
      </p>

      <div className="mt-5 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </>
        ) : claims.length === 0 ? (
          <EmptyState
            icon={<FiUmbrella className="h-6 w-6" />}
            title="No claims filed"
            description="File a claim from a rental's page if something goes wrong — coverage is included with every rental."
          />
        ) : (
          claims.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-50">
                  <FiShield className="h-5 w-5 text-secondary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {c.claim_type[0].toUpperCase() + c.claim_type.slice(1)} claim ·{" "}
                      {formatMoney(c.estimated_value)}
                    </p>
                    <Badge className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    {c.rental?.item?.title ?? `Rental #${c.rental_id}`} · filed by{" "}
                    {c.claimant?.name} · {formatDateTime(c.created_at)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {c.description}
                  </p>
                  {c.photo_urls?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {c.photo_urls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Claim evidence"
                            className="h-14 w-14 rounded-lg object-cover transition hover:opacity-80"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {c.resolution_notes && (
                    <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                      <span className="font-semibold">Resolution:</span>{" "}
                      {c.resolution_notes}
                    </p>
                  )}
                  <Link
                    href={`/rental/${c.rental_id}`}
                    className="mt-2 inline-block text-xs font-semibold text-primary-600 hover:underline"
                  >
                    View rental →
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
