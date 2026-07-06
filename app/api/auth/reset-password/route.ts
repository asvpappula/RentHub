import { NextResponse } from "next/server";
import { handleApiError, parseBody, rateLimit } from "@/lib/api-helpers";
import { resetPasswordSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    rateLimit(`reset:${request.headers.get("x-forwarded-for") ?? "local"}`, 10);
    const { email } = await parseBody(request, resetPasswordSchema);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
