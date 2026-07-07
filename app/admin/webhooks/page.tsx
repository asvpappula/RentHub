"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface Evt {
  event_id: string;
  type: string;
  status: string;
  error: string | null;
  received_at: string;
  reviewed_at: string | null;
}

function WebhooksInner() {
  const params = useSearchParams();
  const statusFilter = params.get("status");
  const [events, setEvents] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/webhooks${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);
  useEffect(load, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (events.length === 0) return <p className="text-sm text-slate-400">No webhook events.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
            <th className="py-2 pr-3">Event</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Received</th>
            <th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.event_id} className="border-b border-slate-50">
              <td className="py-2 pr-3 font-mono text-[11px] text-slate-500">{e.event_id.slice(0, 20)}…</td>
              <td className="py-2 pr-3 text-slate-700">{e.type}</td>
              <td className="py-2 pr-3">
                <Badge className={
                  e.status === "processed" ? "bg-primary-50 text-primary-700 ring-primary-200"
                  : e.status === "error" ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200"
                }>{e.status}</Badge>
                {e.error && <p className="mt-1 max-w-xs truncate text-[11px] text-rose-500">{e.error}</p>}
              </td>
              <td className="py-2 pr-3 text-xs text-slate-400">{formatDateTime(e.received_at)}</td>
              <td className="py-2 pr-3">
                {e.status === "error" && !e.reviewed_at ? (
                  <AdminButton endpoint={`/api/admin/webhooks/${e.event_id}/review`} body={{}} label="Mark reviewed" onDone={load} />
                ) : e.reviewed_at ? (
                  <span className="text-xs text-slate-400">reviewed</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminWebhooks() {
  return (
    <Suspense>
      <WebhooksInner />
    </Suspense>
  );
}
