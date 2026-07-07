import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import type { User } from "@/types";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Resolves the caller's Supabase session to their public.users profile row.
 * Throws ApiError(401) when unauthenticated.
 */
export async function requireUser(): Promise<{
  user: User;
  admin: ReturnType<typeof createSupabaseAdminClient>;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError("Not authenticated", 401);

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) throw new ApiError("Profile not found", 404);
  return { user: profile as User, admin };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      throw new ApiError(
        `${issue.path.join(".") || "body"}: ${issue.message}`,
        400
      );
    }
    throw err;
  }
}

/** Wraps a route handler with uniform error handling. */
export function handleApiError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.message, err.status);
  console.error("[api]", err);
  return jsonError("Internal server error", 500);
}

/**
 * Durable, serverless-safe rate limiter backed by the Postgres
 * check_rate_limit() function (atomic upsert). Survives across lambda
 * instances, unlike an in-memory map. Throws ApiError(429) when exceeded.
 *
 * Fails OPEN on infrastructure error (never blocks a legitimate request
 * because the limiter DB call hiccuped) but logs it.
 */
export async function rateLimit(
  key: string,
  limit = 100,
  windowSeconds = 60
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] check failed, failing open:", error.message);
      return;
    }
    if (data === false) throw new ApiError("Too many requests", 429);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[rate-limit] unexpected error, failing open:", err);
  }
}

/** Best-effort client IP for anonymous (pre-auth) rate-limit keys. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

export async function createNotification(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: number,
  type: string,
  title: string,
  message?: string,
  relatedRentalId?: number
) {
  await admin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message: message ?? null,
    related_rental_id: relatedRentalId ?? null,
  });
}
