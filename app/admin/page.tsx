"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiAlertTriangle,
  FiShield,
  FiCreditCard,
  FiDollarSign,
  FiActivity,
  FiFlag,
  FiUserX,
  FiEyeOff,
} from "react-icons/fi";
import Skeleton from "@/components/ui/Skeleton";

interface Summary {
  openDisputes: number;
  openClaims: number;
  chargebacks: number;
  heldPayouts: number;
  failedPayouts: number;
  webhookFailures: number;
  fraudFlags: number;
  suspendedUsers: number;
  hiddenListings: number;
}

const CARDS: {
  key: keyof Summary;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}[] = [
  { key: "openDisputes", label: "Open disputes", href: "/admin/disputes", icon: FiAlertTriangle, alert: true },
  { key: "openClaims", label: "Open claims", href: "/admin/claims", icon: FiShield, alert: true },
  { key: "chargebacks", label: "Chargebacks", href: "/admin/payments", icon: FiCreditCard, alert: true },
  { key: "heldPayouts", label: "Held/blocked payouts", href: "/admin/payouts", icon: FiDollarSign },
  { key: "failedPayouts", label: "Failed payouts", href: "/admin/payouts?status=failed", icon: FiDollarSign, alert: true },
  { key: "webhookFailures", label: "Webhook failures", href: "/admin/webhooks?status=error", icon: FiActivity, alert: true },
  { key: "fraudFlags", label: "High-risk fraud flags", href: "/admin/users", icon: FiFlag, alert: true },
  { key: "suspendedUsers", label: "Suspended users", href: "/admin/users?filter=suspended", icon: FiUserX },
  { key: "hiddenListings", label: "Hidden listings", href: "/admin/listings?filter=hidden", icon: FiEyeOff },
];

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/summary")
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Operational queues. Numbers link to the relevant workspace.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CARDS.map((c) => {
          const value = summary?.[c.key] ?? 0;
          const highlight = c.alert && value > 0;
          return (
            <Link
              key={c.key}
              href={c.href}
              className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
                highlight
                  ? "border-rose-200 bg-rose-50/50"
                  : "border-slate-100 bg-white"
              }`}
            >
              <c.icon
                className={`h-5 w-5 ${highlight ? "text-rose-500" : "text-slate-400"}`}
              />
              <p
                className={`mt-2 text-2xl font-bold ${
                  highlight ? "text-rose-700" : "text-slate-900"
                }`}
              >
                {value}
              </p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
