import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, parseBody } from "@/lib/api-helpers";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const schema = z.object({
  email: z.email(),
  token: z.string().min(6),
});

/** Verifies an email OTP token (Supabase also supports link-based verification). */
export async function POST(request: Request) {
  try {
    const { email, token } = await parseBody(request, schema);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
