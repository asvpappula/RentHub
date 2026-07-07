import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseBody } from "@/lib/api-helpers";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { sendTransactional } from "@/lib/email";

const schema = z.object({
  action: z.enum(["hide", "unhide"]),
  reason: z.string().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    const { user, admin } = await requireAdmin();
    const { action, reason } = await parseBody(request, schema);

    const { data: item } = await admin
      .from("items")
      .select("id, title, owner_id")
      .eq("id", itemId)
      .single();
    if (!item) throw new ApiError("Item not found", 404);

    await admin
      .from("items")
      .update({ hidden: action === "hide" })
      .eq("id", itemId);

    await sendTransactional(admin, {
      userId: item.owner_id,
      notificationType: "message",
      subject:
        action === "hide"
          ? "Your listing was hidden by RentHub"
          : "Your listing is visible again",
      body:
        action === "hide"
          ? `Your listing "${item.title}" was hidden pending review${reason ? `: ${reason}` : "."} It won't appear in search until restored.`
          : `Your listing "${item.title}" has been restored and is visible again.`,
      dedupeKey: `item-${itemId}-${action}-${Date.now()}`,
    });

    await logAdminAction(admin, user.id, {
      actionType: `listing_${action}`,
      targetType: "item",
      targetId: id,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
