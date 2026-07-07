import { NextResponse } from "next/server";
import { clientIp, handleApiError, parseBody, rateLimit } from "@/lib/api-helpers";
import { resetPasswordSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    await rateLimit(`reset:${clientIp(request)}`, 10);
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
