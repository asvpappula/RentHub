import { ApiError, requireUser } from "@/lib/api-helpers";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { User } from "@/types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Like requireUser(), but also enforces the backend-controlled admin flag.
 * `is_admin` lives on the users row and is never client-editable (all writes
 * are revoked from anon/authenticated in Phase 1), so this is authoritative.
 */
export async function requireAdmin(): Promise<{
  user: User;
  admin: Admin;
}> {
  const { user, admin } = await requireUser();
  if (!user.is_admin) throw new ApiError("Admin access required", 403);
  return { user, admin };
}

interface AdminActionInput {
  actionType: string;
  targetType: string;
  targetId?: string | number | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/** Appends an immutable audit record for a sensitive admin action. */
export async function logAdminAction(
  admin: Admin,
  adminUserId: number,
  input: AdminActionInput
): Promise<void> {
  await admin.from("admin_actions").insert({
    admin_user_id: adminUserId,
    action_type: input.actionType,
    target_type: input.targetType,
    target_id: input.targetId != null ? String(input.targetId) : null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}
