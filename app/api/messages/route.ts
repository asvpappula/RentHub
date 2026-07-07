import { NextResponse } from "next/server";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  rateLimit,
  requireUser,
} from "@/lib/api-helpers";
import { sendMessageSchema } from "@/lib/validation";
import type { Message } from "@/types";

/** GET /api/messages — conversation list (latest message per counterpart). */
export async function GET() {
  try {
    const { user, admin } = await requireUser();

    const { data: messages, error } = await admin
      .from("messages")
      .select(
        "*, sender:users!messages_sender_id_fkey(id, name, avatar_url), recipient:users!messages_recipient_id_fkey(id, name, avatar_url)"
      )
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new ApiError(error.message, 500);

    const byUser = new Map<
      number,
      { lastMessage: Message; unreadCount: number }
    >();
    for (const m of (messages ?? []) as Message[]) {
      const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const entry = byUser.get(otherId);
      const unread = m.recipient_id === user.id && !m.read_at ? 1 : 0;
      if (!entry) byUser.set(otherId, { lastMessage: m, unreadCount: unread });
      else entry.unreadCount += unread;
    }

    const conversations = [...byUser.entries()].map(([otherId, v]) => ({
      otherUser:
        v.lastMessage.sender_id === otherId
          ? v.lastMessage.sender
          : v.lastMessage.recipient,
      lastMessage: v.lastMessage,
      unreadCount: v.unreadCount,
    }));

    return NextResponse.json({ conversations });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/messages — send a message. */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    await rateLimit(`msg:${user.id}`, 60);
    const input = await parseBody(request, sendMessageSchema);

    if (input.recipient_id === user.id)
      throw new ApiError("You cannot message yourself", 400);

    const { data: recipient } = await admin
      .from("users")
      .select("id, name")
      .eq("id", input.recipient_id)
      .single();
    if (!recipient) throw new ApiError("Recipient not found", 404);

    const { data: message, error } = await admin
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: input.recipient_id,
        rental_id: input.rental_id ?? null,
        content: input.content,
      })
      .select(
        "*, sender:users!messages_sender_id_fkey(id, name, avatar_url), recipient:users!messages_recipient_id_fkey(id, name, avatar_url)"
      )
      .single();
    if (error) throw new ApiError(error.message, 400);

    await createNotification(
      admin,
      input.recipient_id,
      "message",
      `New message from ${user.name ?? "a RentHub user"}`,
      input.content.slice(0, 120),
      input.rental_id
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
