import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import {
  ApiError,
  handleApiError,
  parseBody,
  requireUser,
} from "@/lib/api-helpers";

const schema = z.object({
  phone_number: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +15551234567"),
});

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Sends a 6-digit verification code via Twilio SMS.
 * If Twilio isn't configured (no TWILIO_* env vars), runs in dev mode:
 * the code is logged server-side and returned as devCode so the flow
 * can be exercised without an SMS provider.
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await requireUser();
    const { phone_number } = await parseBody(request, schema);

    // Max 3 codes per hour per user.
    const { count } = await admin
      .from("phone_verification_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 3)
      throw new ApiError("Too many attempts — try again in an hour", 429);

    const code = String(randomInt(100000, 1000000));

    // Invalidate previous codes, then store the new one (hashed, 10 min TTL).
    await admin
      .from("phone_verification_codes")
      .delete()
      .eq("user_id", user.id);
    const { error } = await admin.from("phone_verification_codes").insert({
      user_id: user.id,
      phone_number,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new ApiError(error.message, 500);

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } =
      process.env;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      const twilio = (await import("twilio")).default;
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      try {
        await client.messages.create({
          body: `Your RentHub verification code is: ${code}`,
          from: TWILIO_PHONE_NUMBER,
          to: phone_number,
        });
      } catch (err) {
        console.error("[twilio]", err);
        const twilioCode = (err as { code?: number }).code;
        if (twilioCode === 21211)
          throw new ApiError("That phone number doesn't look valid — double-check it.", 400);
        if (twilioCode === 21608 || twilioCode === 572002)
          throw new ApiError(
            "This Twilio trial account can only text verified numbers. Add your number under Verified Caller IDs in the Twilio console, or upgrade the account.",
            400
          );
        if (twilioCode === 572006) {
          // Trial accounts can't send custom SMS bodies at all — fall back
          // to dev mode so verification still works until the account is
          // upgraded (Twilio Console -> Billing).
          console.log(
            `[phone-verification] Twilio trial template restriction — dev-mode code for ${phone_number}: ${code}`
          );
          return NextResponse.json({
            success: true,
            message:
              "Twilio trial accounts can't send custom SMS — code shown on screen. Upgrade the Twilio account to enable real texts.",
            devCode: code,
          });
        }
        throw new ApiError("Could not send SMS — check the number and try again", 500);
      }
      return NextResponse.json({ success: true, message: "Code sent to your phone" });
    }

    // Dev mode — no SMS provider configured.
    console.log(`[phone-verification] DEV MODE code for ${phone_number}: ${code}`);
    return NextResponse.json({
      success: true,
      message: "Dev mode: SMS provider not configured — code returned for testing",
      devCode: code,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
