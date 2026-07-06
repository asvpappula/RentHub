"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FiCheckCircle,
  FiXCircle,
  FiCamera,
  FiShield,
  FiCreditCard,
  FiBell,
  FiLock,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBio(user.bio ?? "");
      setPhone(user.phone_number ?? "");
    }
  }, [user]);

  if (!user) return null;

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          bio: bio || undefined,
          phone_number: phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      await refreshProfile();
      toast("success", "Profile saved.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await refreshProfile();
      toast("success", "Avatar updated.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendPasswordReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) throw new Error("Could not send reset email");
      toast("success", `Password reset link sent to ${user.email}.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed");
    } finally {
      setResetting(false);
    }
  };

  const verifications = [
    { label: "Email", verified: true },
    { label: "Phone", verified: user.phone_verified },
    { label: "Government ID", verified: user.id_verified },
    {
      label: "Background check",
      verified: user.background_check_status === "approved",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Profile */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <div className="mt-5 flex items-center gap-5">
          <div className="relative">
            <Avatar src={user.avatar_url} name={user.name} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-white shadow hover:bg-primary-600"
              aria-label="Change avatar"
            >
              <FiCamera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            {uploading && <p className="text-xs text-primary-600">Uploading…</p>}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
          />
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell renters and owners a little about yourself…"
          />
          <Button loading={saving} onClick={saveProfile}>
            Save changes
          </Button>
        </div>
      </section>

      {/* Verification */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <FiShield className="h-5 w-5 text-primary-600" /> Verification status
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Verified members get more bookings and can rent high-value items.
        </p>
        <ul className="mt-4 space-y-2.5">
          {verifications.map((v) => (
            <li
              key={v.label}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-slate-700">{v.label}</span>
              {v.verified ? (
                <Badge className="bg-primary-50 text-primary-700 ring-primary-200">
                  <FiCheckCircle className="h-3 w-3" /> Verified
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-500 ring-slate-200">
                  <FiXCircle className="h-3 w-3" /> Not verified
                </Badge>
              )}
            </li>
          ))}
        </ul>
        {!user.phone_verified && (
          <Link href="/settings/verify-phone" className="mt-4 inline-block">
            <Button size="sm" variant="secondary">
              Verify phone number (+25 trust)
            </Button>
          </Link>
        )}
        <p className="mt-3 text-xs text-slate-400">
          ID and background verification are coming soon (Stripe Identity and
          Checkr integrations).
        </p>
      </section>

      {/* Payments */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <FiCreditCard className="h-5 w-5 text-secondary-600" /> Payments
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Payments are processed securely by Stripe. Card details are entered at
          checkout and never stored by RentHub. Owner payouts via Stripe Connect
          are coming soon.
        </p>
      </section>

      {/* Notifications */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <FiBell className="h-5 w-5 text-amber-500" /> Notifications
        </h2>
        <div className="mt-4 space-y-3">
          {[
            "Rental requests and confirmations",
            "New messages",
            "Deposit and dispute updates",
          ].map((label) => (
            <label
              key={label}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              {label}
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 accent-emerald-500"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <FiLock className="h-5 w-5 text-slate-500" /> Security
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;ll email you a secure link to change your password.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          loading={resetting}
          onClick={sendPasswordReset}
        >
          Send password reset email
        </Button>
      </section>
    </div>
  );
}
