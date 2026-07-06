import { NextResponse } from "next/server";
import { handleApiError, parseBody, rateLimit } from "@/lib/api-helpers";
import { signupSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    rateLimit(`signup:${request.headers.get("x-forwarded-for") ?? "local"}`, 20);
    const { name, email, password } = await parseBody(request, signupSchema);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email`,
      },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json(
      { user: data.user, needsEmailVerification: !data.session },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
