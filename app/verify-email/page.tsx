"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FiMail, FiCheckCircle } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const { user } = useAuth();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    toast(
      error ? "error" : "success",
      error ? error.message : `Verification email resent to ${email}.`
    );
    setResending(false);
  };

  // If the user landed here from the confirmation link, their session is live.
  if (user) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
          <FiCheckCircle className="h-7 w-7 text-primary-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Email verified!
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account is ready. Welcome to RentHub, {user.name ?? "friend"}.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block">
          <Button>Go to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary-50">
        <FiMail className="h-7 w-7 text-secondary-600" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Check your email</h1>
      <p className="mt-2 text-sm text-slate-500">
        We sent a verification link{email ? ` to ${email}` : ""}. Click it to
        activate your account, then come back and log in.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {email && (
          <Button loading={resending} onClick={resend}>
            Resend email
          </Button>
        )}
        <Link href="/login">
          <Button variant="outline">Back to login</Button>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <Suspense>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
