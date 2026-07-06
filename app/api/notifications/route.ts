import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    let query = admin
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (unreadOnly) query = query.is("read_at", null);

    const { data, error } = await query;
    if (error) throw new ApiError(error.message, 500);

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}
