import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

/** PUT /api/messages/[id]/read — mark a single message as read. */
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, admin } = await requireUser();

    const { data: message } = await admin
      .from("messages")
      .select("id, recipient_id")
      .eq("id", Number(id))
      .single();
    if (!message) throw new ApiError("Message not found", 404);
    if (message.recipient_id !== user.id) throw new ApiError("Forbidden", 403);

    const { data, error } = await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) throw new ApiError(error.message, 400);

    return NextResponse.json({ message: data });
  } catch (err) {
    return handleApiError(err);
  }
}
