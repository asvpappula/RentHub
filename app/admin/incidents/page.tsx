"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface Incident {
  id: number;
  rental_id: number;
  type: string;
  status: string;
  description: string;
  evidence_urls?: string[];
  created_at: string;
  opener?: { name?: string };
  rental?: {
    deposit_status?: string;
    renter_id?: number;
    owner_id?: number;
    item?: { title?: string; serial_number?: string | null };
  };
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  under_review: "bg-sky-50 text-sky-700 ring-sky-200",
  awaiting_evidence: "bg-amber-50 text-amber-700 ring-amber-200",
  resolved_owner: "bg-slate-100 text-slate-600 ring-slate-200",
  resolved_renter: "bg-primary-50 text-primary-700 ring-primary-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/incidents")
      .then((r) => r.json())
      .then((d) => setIncidents(d.incidents ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (incidents.length === 0)
    return <p className="text-sm text-slate-400">No open incidents.</p>;

  return (
    <div className="space-y-3">
      {incidents.map((i) => {
        const open = ["open", "under_review", "awaiting_evidence"].includes(i.status);
        return (
          <div key={i.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                #{i.id} · {i.type.replace(/_/g, " ")} ·{" "}
                {i.rental?.item?.title ?? `Rental ${i.rental_id}`}
              </p>
              <Badge className={STATUS_STYLE[i.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}>
                {i.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Opened by {i.opener?.name ?? "—"} · {formatDateTime(i.created_at)} · deposit{" "}
              {i.rental?.deposit_status ?? "—"}
              {i.rental?.item?.serial_number
                ? ` · serial ${i.rental.item.serial_number}`
                : ""}
            </p>
            <p className="mt-2 text-sm text-slate-600">{i.description}</p>
            {i.evidence_urls && i.evidence_urls.length > 0 && (
              <div className="mt-2 flex gap-2">
                {i.evidence_urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="evidence" className="h-14 w-14 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/rental/${i.rental_id}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                View rental
              </Link>
              {open && (
                <>
                  <AdminButton endpoint={`/api/admin/incidents/${i.id}/action`} body={{ action: "under_review" }} label="Mark reviewing" onDone={load} />
                  <AdminButton endpoint={`/api/admin/incidents/${i.id}/action`} body={{ action: "request_evidence" }} label="Request evidence" onDone={load} />
                  <AdminButton endpoint={`/api/admin/incidents/${i.id}/action`} body={{ action: "resolve_renter" }} label="Resolve → renter" variant="secondary" promptReason confirm="Release the deposit to the renter?" onDone={load} />
                  <AdminButton endpoint={`/api/admin/incidents/${i.id}/action`} body={{ action: "resolve_owner" }} label="Resolve → owner" variant="danger" promptReason confirm="Capture the deposit for the owner?" onDone={load} />
                  <AdminButton endpoint={`/api/admin/incidents/${i.id}/action`} body={{ action: "close" }} label="Close" variant="ghost" promptReason onDone={load} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
