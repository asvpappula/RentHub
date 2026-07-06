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

// ---- lightweight in-memory rate limiter (100 req/min per key) ----
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 100, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw new ApiError("Too many requests", 429);
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
