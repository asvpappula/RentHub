"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiExternalLink,
} from "react-icons/fi";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";

interface Status {
  hasAccount: boolean;
  onboardingComplete: boolean;
  detailsSubmitted: boolean;
  payoutReady: boolean;
  disabledReason: string | null;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
  state:
    | "unavailable"
    | "not_started"
    | "onboarding_started"
    | "pending_verification"
    | "enabled"
    | "restricted";
}

const STATE_UI: Record<
  Status["state"],
  { label: string; color: string; icon: React.ReactNode }
> = {
  unavailable: {
    label: "Payouts launching soon",
    color: "text-slate-500",
    icon: <FiClock className="h-5 w-5 text-slate-400" />,
  },
  not_started: {
    label: "Not started",
    color: "text-slate-600",
    icon: <FiDollarSign className="h-5 w-5 text-slate-400" />,
  },
  onboarding_started: {
    label: "Onboarding in progress",
    color: "text-amber-600",
    icon: <FiClock className="h-5 w-5 text-amber-500" />,
  },
  pending_verification: {
    label: "Pending verification by Stripe",
    color: "text-secondary-600",
    icon: <FiClock className="h-5 w-5 text-secondary-500" />,
  },
  enabled: {
    label: "Payouts enabled",
    color: "text-primary-600",
    icon: <FiCheckCircle className="h-5 w-5 text-primary-600" />,
  },
  restricted: {
    label: "Action required",
    color: "text-rose-600",
    icon: <FiAlertTriangle className="h-5 w-5 text-rose-500" />,
  },
};

function PayoutsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    const endpoint = refresh
      ? "/api/connect/refresh-status"
      : "/api/connect/status";
    const res = await fetch(endpoint, { method: refresh ? "POST" : "GET" });
    const data = await res.json();
    setStatus(data.status ?? null);
    setLoading(false);
  }, []);

  // On return from Stripe (?done / ?refresh), pull the fresh account state.
  useEffect(() => {
    const returned = searchParams.get("done") || searchParams.get("refresh");
    load(!!returned).catch(() => setLoading(false));
  }, [load, searchParams]);

  const startOnboarding = async () => {
    setBusy(true);
    try {
      if (!status?.hasAccount) {
        const res = await fetch("/api/connect/create-account", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not start");
      }
      const linkRes = await fetch("/api/connect/onboarding-link", { method: "POST" });
      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error ?? "Could not create link");
      window.location.href = linkData.url;
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not start onboarding");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const ui = status ? STATE_UI[status.state] : STATE_UI.not_started;
  const unavailable = status?.state === "unavailable";
  const enabled = status?.state === "enabled";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50">
          <FiDollarSign className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
          <p className="text-sm text-slate-500">
            Get paid for your rentals via Stripe.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          {ui.icon}
          <span className={`font-semibold ${ui.color}`}>{ui.label}</span>
        </div>

        {unavailable ? (
          <p className="mt-3 text-sm text-slate-500">
            Owner payouts are being finalized and will open shortly. You can
            list items and receive booking requests now; you&apos;ll be able to
            connect your bank and receive payouts here soon.
          </p>
        ) : enabled ? (
          <p className="mt-3 text-sm text-slate-600">
            You&apos;re all set. Earnings from completed rentals (your rate minus
            the 15% platform fee) are transferred to your connected account
            after each rental completes without an open dispute.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              Connect your bank through Stripe&apos;s secure onboarding to receive
              payouts. RentHub never sees your bank details.
            </p>
            {status?.disabledReason && (
              <p className="mt-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                Stripe needs more information: {status.disabledReason}
              </p>
            )}
            {(status?.requirementsCurrentlyDue?.length ?? 0) > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Outstanding: {status?.requirementsCurrentlyDue.join(", ")}
              </p>
            )}
            <Button className="mt-4" loading={busy} onClick={startOnboarding}>
              <FiExternalLink className="h-4 w-4" />
              {status?.hasAccount ? "Continue Stripe onboarding" : "Set up payouts"}
            </Button>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {!unavailable && !enabled && (
          <Button variant="outline" onClick={() => load(true)}>
            Refresh status
          </Button>
        )}
        <Link href="/owner/dashboard">
          <Button variant="ghost">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense>
      <PayoutsContent />
    </Suspense>
  );
}
