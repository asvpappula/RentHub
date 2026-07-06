"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiSmartphone, FiCheckCircle } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Step = "phone" | "code" | "done";

export default function VerifyPhonePage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(user?.phone_number ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/verification/send-phone-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      // Dev mode (no SMS provider configured) returns the code directly.
      setDevHint(data.devCode ?? null);
      toast("success", data.devCode ? "Dev mode: code shown below." : "Code sent!");
      setStep("code");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/verification/verify-phone-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      await refreshProfile();
      toast("success", "Phone verified! Trust score +25.");
      setStep("done");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  if (user?.phone_verified && step !== "done") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <FiCheckCircle className="mx-auto h-12 w-12 text-primary-600" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Phone already verified
          </h1>
          <p className="mt-1 text-sm text-slate-500">{user.phone_number}</p>
          <Link href="/settings" className="mt-6 inline-block">
            <Button variant="outline">Back to settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        {step === "done" ? (
          <div className="text-center">
            <FiCheckCircle className="mx-auto h-12 w-12 text-primary-600" />
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Phone verified!
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Your trust score just went up by 25 points. The blue badge now
              shows on your profile and listings.
            </p>
            <Button className="mt-6" onClick={() => router.push("/settings")}>
              Back to settings
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-50">
                <FiSmartphone className="h-5 w-5 text-secondary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Verify your phone
                </h1>
                <p className="text-xs text-slate-500">
                  +25 trust score · more bookings · fewer holds
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Input
                label="Phone number"
                type="tel"
                placeholder="+15551234567"
                hint="International format with country code"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={step === "code"}
              />

              {step === "phone" ? (
                <Button className="w-full" loading={busy} onClick={sendCode}>
                  Send code
                </Button>
              ) : (
                <>
                  {devHint && (
                    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                      <span className="font-semibold">Dev mode</span> (no SMS
                      provider configured) — your code is{" "}
                      <span className="font-mono font-bold">{devHint}</span>
                    </p>
                  )}
                  <Input
                    label="6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <Button
                    className="w-full"
                    loading={busy}
                    disabled={code.length !== 6}
                    onClick={verifyCode}
                  >
                    Verify code
                  </Button>
                  <button
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                    }}
                    className="w-full text-center text-xs font-semibold text-primary-600 hover:underline"
                  >
                    Didn&apos;t get it? Change number or resend
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
