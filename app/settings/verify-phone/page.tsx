"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiSmartphone, FiCheckCircle } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input, Select, FieldWrapper } from "@/components/ui/Input";

type Step = "phone" | "code" | "done";

interface Country {
  iso: string;
  name: string;
  flag: string;
  dial: string;
  /** Expected number of national digits (min, max). */
  digits: [number, number];
}

const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", flag: "🇺🇸", dial: "+1", digits: [10, 10] },
  { iso: "CA", name: "Canada", flag: "🇨🇦", dial: "+1", digits: [10, 10] },
  { iso: "GB", name: "United Kingdom", flag: "🇬🇧", dial: "+44", digits: [10, 10] },
  { iso: "AU", name: "Australia", flag: "🇦🇺", dial: "+61", digits: [9, 9] },
  { iso: "IN", name: "India", flag: "🇮🇳", dial: "+91", digits: [10, 10] },
  { iso: "DE", name: "Germany", flag: "🇩🇪", dial: "+49", digits: [10, 11] },
  { iso: "FR", name: "France", flag: "🇫🇷", dial: "+33", digits: [9, 9] },
  { iso: "ES", name: "Spain", flag: "🇪🇸", dial: "+34", digits: [9, 9] },
  { iso: "IT", name: "Italy", flag: "🇮🇹", dial: "+39", digits: [9, 10] },
  { iso: "NL", name: "Netherlands", flag: "🇳🇱", dial: "+31", digits: [9, 9] },
  { iso: "JP", name: "Japan", flag: "🇯🇵", dial: "+81", digits: [10, 10] },
  { iso: "KR", name: "South Korea", flag: "🇰🇷", dial: "+82", digits: [9, 10] },
  { iso: "CN", name: "China", flag: "🇨🇳", dial: "+86", digits: [11, 11] },
  { iso: "BR", name: "Brazil", flag: "🇧🇷", dial: "+55", digits: [10, 11] },
  { iso: "MX", name: "Mexico", flag: "🇲🇽", dial: "+52", digits: [10, 10] },
  { iso: "AR", name: "Argentina", flag: "🇦🇷", dial: "+54", digits: [10, 10] },
  { iso: "ZA", name: "South Africa", flag: "🇿🇦", dial: "+27", digits: [9, 9] },
  { iso: "NG", name: "Nigeria", flag: "🇳🇬", dial: "+234", digits: [10, 10] },
  { iso: "EG", name: "Egypt", flag: "🇪🇬", dial: "+20", digits: [10, 10] },
  { iso: "AE", name: "UAE", flag: "🇦🇪", dial: "+971", digits: [9, 9] },
  { iso: "SA", name: "Saudi Arabia", flag: "🇸🇦", dial: "+966", digits: [9, 9] },
  { iso: "SG", name: "Singapore", flag: "🇸🇬", dial: "+65", digits: [8, 8] },
  { iso: "PH", name: "Philippines", flag: "🇵🇭", dial: "+63", digits: [10, 10] },
  { iso: "ID", name: "Indonesia", flag: "🇮🇩", dial: "+62", digits: [9, 12] },
  { iso: "PK", name: "Pakistan", flag: "🇵🇰", dial: "+92", digits: [10, 10] },
  { iso: "BD", name: "Bangladesh", flag: "🇧🇩", dial: "+880", digits: [10, 10] },
  { iso: "VN", name: "Vietnam", flag: "🇻🇳", dial: "+84", digits: [9, 10] },
  { iso: "TR", name: "Turkey", flag: "🇹🇷", dial: "+90", digits: [10, 10] },
  { iso: "PL", name: "Poland", flag: "🇵🇱", dial: "+48", digits: [9, 9] },
  { iso: "SE", name: "Sweden", flag: "🇸🇪", dial: "+46", digits: [9, 9] },
  { iso: "CH", name: "Switzerland", flag: "🇨🇭", dial: "+41", digits: [9, 9] },
  { iso: "IE", name: "Ireland", flag: "🇮🇪", dial: "+353", digits: [9, 9] },
  { iso: "NZ", name: "New Zealand", flag: "🇳🇿", dial: "+64", digits: [8, 10] },
];

/** US/Canada pretty-print: (925) 968-5111. Others: grouped digits. */
function formatNational(digits: string, dial: string) {
  if (dial === "+1") {
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 10);
    if (digits.length <= 3) return p1;
    if (digits.length <= 6) return `(${p1}) ${p2}`;
    return `(${p1}) ${p2}-${p3}`;
  }
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export default function VerifyPhonePage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [countryIso, setCountryIso] = useState("US");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);

  const country = useMemo(
    () => COUNTRIES.find((c) => c.iso === countryIso) ?? COUNTRIES[0],
    [countryIso]
  );
  const fullNumber = `${country.dial}${digits}`;
  const [minLen, maxLen] = country.digits;
  const lengthOk = digits.length >= minLen && digits.length <= maxLen;
  const lengthHint =
    minLen === maxLen ? `${minLen} digits` : `${minLen}–${maxLen} digits`;

  const sendCode = async () => {
    if (!lengthOk) {
      toast(
        "warning",
        `${country.name} numbers have ${lengthHint} — you entered ${digits.length}.`
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/verification/send-phone-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: fullNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setDevHint(data.devCode ?? null);
      toast(
        "success",
        data.devCode ? "Dev mode: code shown below." : `Code sent to ${fullNumber}!`
      );
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
        body: JSON.stringify({ phone_number: fullNumber, code: code.trim() }),
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
              <Select
                label="Country"
                value={countryIso}
                onChange={(e) => {
                  setCountryIso(e.target.value);
                  setDigits("");
                }}
                disabled={step === "code"}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.flag} {c.name} ({c.dial})
                  </option>
                ))}
              </Select>

              <FieldWrapper
                label="Phone number"
                hint={
                  digits.length > 0 && !lengthOk
                    ? undefined
                    : `${country.name} numbers: ${lengthHint} · sends as ${fullNumber || country.dial + "…"}`
                }
                error={
                  digits.length > 0 && !lengthOk
                    ? `${country.name} numbers have ${lengthHint} — you entered ${digits.length}.`
                    : undefined
                }
              >
                <div className="flex items-stretch">
                  <span className="flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3.5 text-sm font-semibold text-slate-600">
                    {country.flag} {country.dial}
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder={country.dial === "+1" ? "(925) 968-5111" : lengthHint}
                    value={formatNational(digits, country.dial)}
                    onChange={(e) =>
                      setDigits(e.target.value.replace(/\D/g, "").slice(0, maxLen))
                    }
                    disabled={step === "code"}
                    className="h-11 w-full rounded-r-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50"
                  />
                </div>
              </FieldWrapper>

              {step === "phone" ? (
                <Button
                  className="w-full"
                  loading={busy}
                  disabled={!lengthOk}
                  onClick={sendCode}
                >
                  Send code
                </Button>
              ) : (
                <>
                  {devHint && (
                    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                      <span className="font-semibold">Test mode</span> — real SMS
                      isn&apos;t available yet (Twilio trial or no provider
                      configured). Your code is{" "}
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
