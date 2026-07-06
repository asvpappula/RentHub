import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

/**
 * GET /api/messages/[id] — the conversation with user [id].
 * Returns the last 50 messages (oldest first) and marks incoming ones read.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const otherId = Number(id);
    const { user, admin } = await requireUser();

    const { data: messages, error } = await admin
      .from("messages")
      .select(
        "*, sender:users!messages_sender_id_fkey(id, name, avatar_url), recipient:users!messages_recipient_id_fkey(id, name, avatar_url)"
      )
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new ApiError(error.message, 500);

    await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", otherId)
      .eq("recipient_id", user.id)
      .is("read_at", null);

    return NextResponse.json({ messages: (messages ?? []).reverse() });
  } catch (err) {
    return handleApiError(err);
  }
}
