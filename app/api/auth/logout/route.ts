import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
