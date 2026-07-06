"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FcGoogle } from "react-icons/fc";
import { signupSchema } from "@/lib/validation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type FormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await signUp(values.name, values.email, values.password);
      toast("success", "Account created! Check your email to verify.");
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      toast(
        "error",
        err instanceof Error ? err.message : "Could not create your account."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rent from neighbors, or earn from what you own.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input
            label="Full name"
            autoComplete="name"
            placeholder="Alex Johnson"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="8+ characters"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Sign up
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            signInWithGoogle().catch(() =>
              toast("error", "Google sign-in is not configured yet.")
            )
          }
        >
          <FcGoogle className="h-5 w-5" />
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
