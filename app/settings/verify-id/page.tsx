"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FiCheckCircle, FiCreditCard, FiShield } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";

function VerifyIdContent() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(searchParams.get("check") === "1");
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  // Returned from the hosted Stripe flow — poll the result.
  useEffect(() => {
    if (!checking || !user) return;
    fetch("/api/verification/id/check", { method: "POST" })
      .then((r) => r.json())
      .then(async (data) => {
        setLastStatus(data.status ?? null);
        if (data.status === "verified") {
          await refreshProfile();
          toast("success", "Government ID verified! Trust score +30.");
        } else if (data.status === "requires_input") {
          toast(
            "warning",
            `Verification didn't complete${data.lastError ? `: ${data.lastError}` : ""}. Try again below.`
          );
        } else if (data.status === "processing") {
          toast("info", "Stripe is still processing your documents — check back shortly.");
        }
      })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, user?.id]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/verification/id/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start verification");
      window.location.href = data.url;
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not start verification");
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        {user.id_verified ? (
          <div className="text-center">
            <FiCheckCircle className="mx-auto h-12 w-12 text-primary-600" />
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Government ID verified
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              You&apos;re a fully verified member — the green shield shows on
              your profile and every listing.
            </p>
            <Link href="/settings" className="mt-6 inline-block">
              <Button variant="outline">Back to settings</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50">
                <FiCreditCard className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Verify your government ID
                </h1>
                <p className="text-xs text-slate-500">
                  +30 trust score · unlock high-value rentals
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
              <li className="flex gap-2">
                <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                Handled entirely by Stripe Identity — RentHub never sees or
                stores your document.
              </li>
              <li className="flex gap-2">
                <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                You&apos;ll photograph a government ID (license, passport) and
                take a quick selfie.
              </li>
              <li className="flex gap-2">
                <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                Takes about 2 minutes; results are usually instant.
              </li>
            </ul>

            {lastStatus === "processing" && (
              <p className="mt-4 rounded-xl bg-secondary-50 p-3 text-xs text-secondary-700">
                Stripe is still processing your documents. Refresh this page in
                a minute, or wait for the notification.
              </p>
            )}

            <Button
              className="mt-6 w-full"
              size="lg"
              loading={busy || checking}
              onClick={start}
            >
              {checking ? "Checking result…" : "Start verification"}
            </Button>
            <p className="mt-3 text-center text-xs text-slate-400">
              You&apos;ll be redirected to Stripe and back.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyIdPage() {
  return (
    <Suspense>
      <VerifyIdContent />
    </Suspense>
  );
}
