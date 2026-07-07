import { NextResponse } from "next/server";
import { createNotification, handleApiError, requireUser } from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";

/**
 * Polls the user's Stripe Identity session after they return from the
 * hosted flow. (The webhook also updates this in production — this makes
 * the result immediate and works without a webhook in local dev.)
 */
export async function POST() {
  try {
    const { user, admin } = await requireUser();
    if (user.id_verified) return NextResponse.json({ status: "verified" });
    if (!user.stripe_verification_session_id)
      return NextResponse.json({ status: "not_started" });

    const stripe = getStripeServer();
    const session = await stripe.identity.verificationSessions.retrieve(
      user.stripe_verification_session_id
    );

    if (session.status === "verified") {
      await admin
        .from("users")
        .update({ id_verified: true, id_verified_at: new Date().toISOString() })
        .eq("id", user.id);
      await createNotification(
        admin,
        user.id,
        "message",
        "Government ID verified ✓",
        "Your trust score went up by 30 points. You're now a fully verified member."
      );
    }

    return NextResponse.json({
      status: session.status,
      lastError: session.last_error?.reason ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
