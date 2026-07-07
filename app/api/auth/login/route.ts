import { NextResponse } from "next/server";
import { clientIp, handleApiError, parseBody, rateLimit } from "@/lib/api-helpers";
import { loginSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    await rateLimit(`login:${clientIp(request)}`, 30);
    const { email, password } = await parseBody(request, loginSchema);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    return NextResponse.json({ user: data.user });
  } catch (err) {
    return handleApiError(err);
  }
}
