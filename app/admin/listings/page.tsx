"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface AdminItem {
  id: number;
  title: string;
  category: string;
  daily_rate: number;
  availability_status: string;
  hidden: boolean;
  gps_tracking_required: boolean;
  view_count: number;
  rental_count: number;
  owner?: { id: number; name?: string; suspended?: boolean };
}

function ListingsInner() {
  const params = useSearchParams();
  const filter = params.get("filter");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter) qs.set("filter", filter);
    if (search) qs.set("search", search);
    fetch(`/api/admin/items?${qs}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [filter, search]);
  useEffect(load, [load]);

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="h-10 w-full max-w-sm rounded-lg border border-slate-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
        />
      </form>
      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No listings.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <Link href={`/item/${it.id}`} className="hover:text-primary-700">{it.title}</Link>
                  {it.hidden && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">hidden</Badge>}
                  {it.gps_tracking_required && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">GPS</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {it.category} · {formatMoney(it.daily_rate)}/day · owner{" "}
                  <Link href={`/profile/${it.owner?.id}`} className="hover:underline">{it.owner?.name}</Link>
                  {it.owner?.suspended && <span className="ml-1 font-bold text-rose-600">(suspended)</span>}
                  · {it.view_count} views · {it.rental_count} rentals
                </p>
              </div>
              <div className="flex gap-2">
                {it.hidden ? (
                  <AdminButton endpoint={`/api/admin/items/${it.id}/action`} body={{ action: "unhide" }} label="Restore" variant="secondary" onDone={load} />
                ) : (
                  <AdminButton endpoint={`/api/admin/items/${it.id}/action`} body={{ action: "hide" }} label="Hide" variant="danger" promptReason confirm={`Hide "${it.title}"?`} onDone={load} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminListings() {
  return (
    <Suspense>
      <ListingsInner />
    </Suspense>
  );
}
