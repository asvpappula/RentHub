"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiCheckCircle,
  FiLock,
  FiTrendingUp,
  FiShield,
  FiMail,
  FiSmartphone,
  FiCreditCard,
  FiStar,
} from "react-icons/fi";
import type { InsuranceClaim } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { trustBreakdown, trustScore, trustLevel } from "@/lib/trust";
import TrustScore from "@/components/TrustScore";
import Button from "@/components/ui/Button";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

const BADGES = [
  {
    icon: FiMail,
    name: "Email verified",
    meaning: "Confirmed their email address at signup. Every active member has this.",
  },
  {
    icon: FiSmartphone,
    name: "Phone verified",
    meaning: "Confirmed a real phone number with an SMS code.",
  },
  {
    icon: FiCreditCard,
    name: "ID verified",
    meaning:
      "Verified a government ID and selfie through Stripe Identity. RentHub never sees the document.",
  },
  {
    icon: FiStar,
    name: "Trusted owner / renter",
    meaning: "Shown automatically when someone's trust score reaches 75+.",
  },
];

const BENEFITS = [
  "Owners approve verified renters far more often — and faster.",
  "Renters book from verified owners with confidence.",
  "Higher trust lowers your fraud-risk score, so nothing blocks your rentals.",
  "High-value items (cameras, tools, vehicles) effectively require ID verification.",
  "A 75+ score earns the green “Trusted” chip on your listings and requests.",
];

export default function TrustPage() {
  const { user } = useAuth();
  const [cleanClaims, setCleanClaims] = useState(false);

  // The claims bonus needs your claims history — checked here, live.
  useEffect(() => {
    if (!user) return;
    fetch("/api/claims")
      .then((r) => r.json())
      .then((data) => {
        const claimsAgainstMe = (data.claims ?? []).filter(
          (c: InsuranceClaim) => c.claimant_id !== user.id
        );
        setCleanClaims(
          (user.total_rentals ?? 0) >= 5 && claimsAgainstMe.length === 0
        );
      })
      .catch(() => {});
  }, [user]);

  const breakdown = user
    ? trustBreakdown(user, { cleanClaimsRecord: cleanClaims })
    : trustBreakdown({}, {});
  const score = user ? trustScore(user, { cleanClaimsRecord: cleanClaims }) : 0;

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
            <FiShield className="h-3.5 w-3.5" />
            Trust &amp; Safety
          </span>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            How trust works on RentHub
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-slate-500">
            Every member has a trust score from 0 to 100. Verifications build
            the base — your track record grows it from there.
          </p>
        </div>

        {/* Personal score */}
        {user && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:flex-row sm:gap-8 sm:p-8">
            <div className="flex flex-col items-center">
              <TrustScore user={user} size="lg" cleanClaimsRecord={cleanClaims} />
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Your score
              </p>
              <p
                className={cn(
                  "text-xs font-medium",
                  trustLevel(score) === "high"
                    ? "text-primary-600"
                    : trustLevel(score) === "medium"
                      ? "text-amber-600"
                      : "text-rose-600"
                )}
              >
                {trustLevel(score) === "high"
                  ? "Trusted member"
                  : trustLevel(score) === "medium"
                    ? "Building trust"
                    : "Just getting started"}
              </p>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-slate-600">
                {score >= 100
                  ? "Perfect score — you've earned every point available. 🎉"
                  : `You're ${100 - score} points from a perfect score. The fastest gains are below — green rows are already yours.`}
              </p>
              {!user.id_verified && (
                <Link href="/settings/verify-id" className="mt-3 inline-block">
                  <Button size="sm">Verify ID now (+30)</Button>
                </Link>
              )}
              {user.id_verified && !user.phone_verified && (
                <Link href="/settings/verify-phone" className="mt-3 inline-block">
                  <Button size="sm">Verify phone now (+25)</Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Breakdown */}
        <h2 className="mt-10 text-lg font-bold text-slate-900">
          The path to 100
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Verifications give you the 80-point base. The last 20 points are
          earned through how you rent.
        </p>
        <div className="mt-4 space-y-2">
          {breakdown.map((item) => (
            <div
              key={item.key}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4",
                item.earned
                  ? "border-primary-100 bg-primary-50/50"
                  : "border-slate-100 bg-white"
              )}
            >
              {item.earned ? (
                <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
              ) : (
                <FiLock className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    item.earned ? "text-slate-900" : "text-slate-600"
                  )}
                >
                  {item.label}
                </p>
                <p className="text-xs text-slate-500">{item.hint}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold",
                  item.earned ? "text-primary-700" : "text-slate-400"
                )}
              >
                +{item.points}
              </span>
            </div>
          ))}
        </div>

        {/* Badges */}
        <h2 className="mt-10 text-lg font-bold text-slate-900">
          What the badges mean
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BADGES.map((b) => (
            <div
              key={b.name}
              className="rounded-xl border border-slate-100 bg-white p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <b.icon className="h-4 w-4 text-primary-600" />
                {b.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">{b.meaning}</p>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <h2 className="mt-10 flex items-center gap-2 text-lg font-bold text-slate-900">
          <FiTrendingUp className="h-5 w-5 text-primary-600" />
          Why it's worth it
        </h2>
        <ul className="mt-3 space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex gap-2 text-sm text-slate-600">
              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
              {b}
            </li>
          ))}
        </ul>

        {!user && (
          <div className="mt-10 rounded-2xl bg-primary-600 p-8 text-center text-white">
            <h2 className="text-xl font-bold">Start building trust today</h2>
            <p className="mt-1 text-sm text-primary-100">
              Create an account and verify your phone and ID in minutes.
            </p>
            <Link href="/signup" className="mt-4 inline-block">
              <Button variant="outline" className="border-white bg-white">
                Sign up free
              </Button>
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
