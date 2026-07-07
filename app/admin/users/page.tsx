"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import AdminButton from "@/components/admin/AdminButton";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  suspended: boolean;
  suspended_reason: string | null;
  phone_verified: boolean;
  id_verified: boolean;
  average_rating: number | null;
  listings_count: number;
  rentals_count: number;
  payout_onboarded: boolean;
  created_at: string;
}

function UsersInner() {
  const params = useSearchParams();
  const filter = params.get("filter");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter) qs.set("filter", filter);
    if (search) qs.set("search", search);
    fetch(`/api/admin/users?${qs}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  }, [filter, search]);
  useEffect(load, [load]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mb-4"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="h-10 w-full max-w-sm rounded-lg border border-slate-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
        />
      </form>
      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-400">No users.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <Link href={`/profile/${u.id}`} className="hover:text-primary-700">{u.name}</Link>
                  {u.suspended && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">suspended</Badge>}
                  {u.id_verified && <Badge className="bg-primary-50 text-primary-700 ring-primary-200">ID ✓</Badge>}
                </p>
                <p className="text-xs text-slate-500">{u.email} · joined {formatDate(u.created_at)}</p>
                <p className="text-xs text-slate-400">
                  {u.listings_count} listings · {u.rentals_count} rentals · payouts{" "}
                  {u.payout_onboarded ? "enabled" : "not set up"}
                  {u.suspended_reason ? ` · reason: ${u.suspended_reason}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {u.suspended ? (
                  <AdminButton endpoint={`/api/admin/users/${u.id}/action`} body={{ action: "unsuspend" }} label="Unsuspend" variant="secondary" onDone={load} />
                ) : (
                  <AdminButton endpoint={`/api/admin/users/${u.id}/action`} body={{ action: "suspend" }} label="Suspend" variant="danger" promptReason confirm={`Suspend ${u.name}?`} onDone={load} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  return (
    <Suspense>
      <UsersInner />
    </Suspense>
  );
}
