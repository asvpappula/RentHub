import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ApiError,
  createNotification,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

const schema = z.object({
  phone_number: z.string().regex(/^\+[1-9]\d{7,14}$/),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { phone_number, code } = await parseBody(request, schema);

    const { data: record } = await admin
      .from("phone_verification_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("phone_number", phone_number)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) throw new ApiError("No code found — request a new one", 404);
    if (new Date(record.expires_at).getTime() < Date.now())
      throw new ApiError("Code expired — request a new one", 400);
    if (record.attempts >= 5)
      throw new ApiError("Too many wrong attempts — request a new code", 429);

    const hash = createHash("sha256").update(code).digest("hex");
    if (hash !== record.code_hash) {
      await admin
        .from("phone_verification_codes")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);
      throw new ApiError("Incorrect code", 400);
    }

    // Verified — flag the profile and clean up.
    const { error } = await admin
      .from("users")
      .update({ phone_verified: true, phone_number })
      .eq("id", user.id);
    if (error) throw new ApiError(error.message, 500);

    await admin
      .from("phone_verification_codes")
      .delete()
      .eq("user_id", user.id);

    await createNotification(
      admin,
      user.id,
      "message",
      "Phone verified ✓",
      "Your trust score went up by 25 points. Verified members get more bookings."
    );

    return NextResponse.json({ success: true, message: "Phone verified!" });
  } catch (err) {
    return handleApiError(err);
  }
}
