import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: notification } = await admin
      .from("notifications")
      .select("id, user_id")
      .eq("id", Number(id))
      .single();
    if (!notification) throw new ApiError("Notification not found", 404);
    if (notification.user_id !== user.id) throw new ApiError("Forbidden", 403);

    const { data, error } = await admin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ notification: data });
  } catch (err) {
    return handleApiError(err);
  }
}
