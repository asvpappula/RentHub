import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { sendTransactional } from "@/lib/email";

const schema = z.object({
  action: z.enum(["suspend", "unsuspend"]),
  reason: z.string().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const targetId = Number(id);
    const { user, admin } = await requireAdmin();
    const { action, reason } = await parseBody(request, schema);

    if (targetId === user.id)
      throw new ApiError("You can't suspend your own admin account", 400);

    const { data: target } = await admin
      .from("users")
      .select("id, is_admin")
      .eq("id", targetId)
      .single();
    if (!target) throw new ApiError("User not found", 404);
    if (target.is_admin)
      throw new ApiError("Admins cannot be suspended from here", 400);

    if (action === "suspend") {
      await admin
        .from("users")
        .update({
          suspended: true,
          suspended_reason: reason ?? null,
          suspended_at: new Date().toISOString(),
        })
        .eq("id", targetId);
      await sendTransactional(admin, {
        userId: targetId,
        notificationType: "message",
        subject: "Your RentHub account has been suspended",
        body: `Your account has been suspended${reason ? `: ${reason}` : "."} You can't list, rent, or message while suspended. Contact support if you believe this is a mistake.`,
        dedupeKey: `user-${targetId}-suspend-${Date.now()}`,
      });
    } else {
      await admin
        .from("users")
        .update({ suspended: false, suspended_reason: null, suspended_at: null })
        .eq("id", targetId);
      await sendTransactional(admin, {
        userId: targetId,
        notificationType: "message",
        subject: "Your RentHub account has been reinstated",
        body: "Your account is active again. Welcome back.",
        dedupeKey: `user-${targetId}-unsuspend-${Date.now()}`,
      });
    }

    await logAdminAction(admin, user.id, {
      actionType: `user_${action}`,
      targetType: "user",
      targetId: id,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
