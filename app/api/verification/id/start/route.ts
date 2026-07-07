import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireUser } from "@/lib/api-helpers";
import { getStripeServer } from "@/lib/stripe-server";

/** Creates a Stripe Identity verification session (document + selfie). */
export async function POST() {
  try {
    const { user, admin } = await requireUser();
    if (user.id_verified)
      throw new ApiError("Your ID is already verified", 409);

    const stripe = getStripeServer();
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { renthub_user_id: String(user.id) },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/verify-id?check=1`,
    });

    await admin
      .from("users")
      .update({ stripe_verification_session_id: session.id })
      .eq("id", user.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
