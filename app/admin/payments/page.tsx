"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatDateTime } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface Payment {
  rental_id: number;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount_cents: number;
  status: string;
  dispute_status: string | null;
  payout_status?: string | null;
  created_at: string;
  renter?: { name?: string };
  owner?: { name?: string };
  rental?: { item?: { title?: string } };
}

export default function AdminChargebacks() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/payments")
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (payments.length === 0)
    return <p className="text-sm text-slate-400">No chargebacks or payment disputes. 🎉</p>;

  return (
    <>
      <p className="mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        Card chargebacks. RentHub does not auto-submit Stripe evidence — mark
        items needing action in the Stripe dashboard. Blocking the payout is
        real and reverses an already-sent transfer if needed.
      </p>
      <div className="space-y-3">
        {payments.map((p) => (
          <div key={p.rental_id} className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                Rental #{p.rental_id} · {formatMoney(p.amount_cents / 100)} · {p.rental?.item?.title}
              </p>
              <Badge className="bg-rose-50 text-rose-700 ring-rose-200">
                {p.dispute_status ?? "disputed"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              renter {p.renter?.name} · owner {p.owner?.name} · payout {p.payout_status ?? "—"} ·{" "}
              {formatDateTime(p.created_at)}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
              {p.stripe_payment_intent_id} {p.stripe_charge_id ? `· ${p.stripe_charge_id}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/rental/${p.rental_id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">View rental</Link>
              <AdminButton endpoint={`/api/admin/payments/${p.rental_id}/action`} body={{ action: "block_payout" }} label="Block/reverse payout" variant="danger" promptReason onDone={load} />
              <AdminButton endpoint={`/api/admin/payments/${p.rental_id}/action`} body={{ action: "needs_stripe_action" }} label="Needs Stripe action" promptReason onDone={load} />
              <AdminButton endpoint={`/api/admin/payments/${p.rental_id}/action`} body={{ action: "mark_reviewed" }} label="Mark reviewed" variant="ghost" onDone={load} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
