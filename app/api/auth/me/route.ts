import { NextResponse } from "next/server";
import { handleApiError, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    const { user } = await requireUser();
    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
