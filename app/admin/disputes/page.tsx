"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface Dispute {
  id: number;
  rental_id: number;
  dispute_type: string;
  status: string;
  description: string;
  evidence_photos: string[];
  created_at: string;
  reporter?: { name?: string };
  payout_status?: string | null;
  rental?: {
    deposit_amount?: number;
    deposit_status?: string;
    status?: string;
    item?: { title?: string };
    renter?: { name?: string };
    owner?: { name?: string };
  };
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/disputes")
      .then((r) => r.json())
      .then((d) => setDisputes(d.disputes ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (disputes.length === 0)
    return <p className="text-sm text-slate-400">No disputes.</p>;

  return (
    <div className="space-y-3">
      {disputes.map((d) => {
        const open = ["pending", "under_review", "appealed"].includes(d.status);
        return (
          <div key={d.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                #{d.id} · {d.dispute_type} · {d.rental?.item?.title ?? `Rental ${d.rental_id}`}
              </p>
              <Badge className={open ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-primary-50 text-primary-700 ring-primary-200"}>
                {d.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Reporter {d.reporter?.name} · renter {d.rental?.renter?.name} · owner{" "}
              {d.rental?.owner?.name} · {formatDateTime(d.created_at)}
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{d.description}</p>
            <p className="mt-1 text-xs text-slate-400">
              Deposit {formatMoney(d.rental?.deposit_amount ?? 0)} ({d.rental?.deposit_status}) ·
              payout {d.payout_status ?? "—"}
            </p>
            {d.evidence_photos?.length > 0 && (
              <div className="mt-2 flex gap-2">
                {d.evidence_photos.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="evidence" className="h-14 w-14 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/rental/${d.rental_id}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                View rental
              </Link>
              {open && (
                <>
                  <AdminButton endpoint={`/api/admin/disputes/${d.id}/action`} body={{ action: "under_review" }} label="Mark reviewing" onDone={load} />
                  <AdminButton endpoint={`/api/admin/disputes/${d.id}/action`} body={{ action: "request_evidence" }} label="Request evidence" onDone={load} />
                  <AdminButton endpoint={`/api/admin/disputes/${d.id}/action`} body={{ action: "resolve_renter" }} label="Resolve → renter" variant="secondary" promptReason confirm="Release the deposit to the renter?" onDone={load} />
                  <AdminButton endpoint={`/api/admin/disputes/${d.id}/action`} body={{ action: "resolve_owner" }} label="Resolve → owner" variant="danger" promptReason confirm="Capture the deposit for the owner?" onDone={load} />
                  <AdminButton endpoint={`/api/admin/disputes/${d.id}/action`} body={{ action: "close" }} label="Close" variant="ghost" promptReason onDone={load} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
