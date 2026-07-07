"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface Payout {
  rental_id: number;
  amount_cents: number;
  status: string;
  hold_reason: string | null;
  owner?: { name?: string; suspended?: boolean };
  rental?: { status?: string; item?: { title?: string } };
  payment?: { status?: string; dispute_status?: string };
}

function PayoutsInner() {
  const params = useSearchParams();
  const statusFilter = params.get("status");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/payouts${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((r) => r.json())
      .then((d) => setPayouts(d.payouts ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);
  useEffect(load, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (payouts.length === 0) return <p className="text-sm text-slate-400">No payouts in this queue.</p>;

  return (
    <div className="space-y-3">
      {payouts.map((p) => {
        const releasable = ["pending", "blocked"].includes(p.status);
        return (
          <div key={p.rental_id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                Rental #{p.rental_id} · {formatMoney(p.amount_cents / 100)} → {p.owner?.name}
                {p.owner?.suspended && <span className="ml-2 text-xs font-bold text-rose-600">SUSPENDED</span>}
              </p>
              <Badge className={
                p.status === "transferred" ? "bg-primary-50 text-primary-700 ring-primary-200"
                : p.status === "failed" || p.status === "blocked" ? "bg-rose-50 text-rose-700 ring-rose-200"
                : "bg-amber-50 text-amber-700 ring-amber-200"
              }>{p.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {p.rental?.item?.title} · rental {p.rental?.status} · payment {p.payment?.status}
              {p.payment?.dispute_status ? ` · chargeback ${p.payment.dispute_status}` : ""}
              {p.hold_reason ? ` · hold: ${p.hold_reason}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/rental/${p.rental_id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">View rental</Link>
              {releasable && (
                <>
                  <AdminButton endpoint={`/api/admin/payouts/${p.rental_id}/action`} body={{ action: "release" }} label="Release payout" variant="secondary" confirm="Release this payout to the owner? All eligibility guards still apply." onDone={load} />
                  <AdminButton endpoint={`/api/admin/payouts/${p.rental_id}/action`} body={{ action: "block" }} label="Block" variant="danger" promptReason onDone={load} />
                  <AdminButton endpoint={`/api/admin/payouts/${p.rental_id}/action`} body={{ action: "under_review" }} label="Hold for review" promptReason onDone={load} />
                </>
              )}
              {p.status === "transferred" && (
                <AdminButton endpoint={`/api/admin/payouts/${p.rental_id}/action`} body={{ action: "block" }} label="Reverse (claw back)" variant="danger" promptReason confirm="Reverse this already-sent transfer?" onDone={load} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPayouts() {
  return (
    <Suspense>
      <PayoutsInner />
    </Suspense>
  );
}
