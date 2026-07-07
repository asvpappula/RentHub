"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface Claim {
  id: number;
  rental_id: number;
  claim_type: string;
  description: string;
  estimated_value: number;
  status: string;
  photo_urls: string[];
  created_at: string;
  claimant?: { name?: string };
  rental?: { deposit_amount?: number; deposit_status?: string; item?: { title?: string } };
}

export default function AdminClaims() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/claims")
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (claims.length === 0) return <p className="text-sm text-slate-400">No claims.</p>;

  return (
    <>
      <p className="mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        Damage-protection claims are reviewed by a human here. RentHub has no
        automated insurance fund — approved compensation is applied via the
        deposit on the linked rental (resolve the dispute in the owner&apos;s
        favour). Approving records the decision and notifies the claimant.
      </p>
      <div className="space-y-3">
        {claims.map((c) => {
          const open = ["pending", "under_review"].includes(c.status);
          return (
            <div key={c.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  #{c.id} · {c.claim_type} · {formatMoney(c.estimated_value)} ·{" "}
                  {c.rental?.item?.title ?? `Rental ${c.rental_id}`}
                </p>
                <Badge className={
                  c.status === "approved" ? "bg-primary-50 text-primary-700 ring-primary-200"
                  : c.status === "rejected" ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200"
                }>{c.status.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Claimant {c.claimant?.name} · deposit {formatMoney(c.rental?.deposit_amount ?? 0)} (
                {c.rental?.deposit_status}) · {formatDateTime(c.created_at)}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.description}</p>
              {c.photo_urls?.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {c.photo_urls.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="evidence" className="h-14 w-14 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/rental/${c.rental_id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">View rental</Link>
                {open && (
                  <>
                    <AdminButton endpoint={`/api/admin/claims/${c.id}/action`} body={{ action: "under_review" }} label="Mark reviewing" onDone={load} />
                    <AdminButton endpoint={`/api/admin/claims/${c.id}/action`} body={{ action: "request_evidence" }} label="Request evidence" onDone={load} />
                    <AdminButton endpoint={`/api/admin/claims/${c.id}/action`} body={{ action: "approve" }} label="Approve" variant="secondary" promptReason onDone={load} />
                    <AdminButton endpoint={`/api/admin/claims/${c.id}/action`} body={{ action: "deny" }} label="Deny" variant="danger" promptReason onDone={load} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
