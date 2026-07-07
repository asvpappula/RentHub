import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeServer } from "@/lib/stripe-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripeServer();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const rentalId = Number(intent.metadata.rental_id);
        if (!rentalId) break;

        if (intent.metadata.kind === "deposit") {
          await admin
            .from("rentals")
            .update({ deposit_status: "claimed" })
            .eq("id", rentalId)
            .eq("deposit_status", "held");
        } else {
          const { data: rental } = await admin
            .from("rentals")
            .update({ status: "confirmed" })
            .eq("id", rentalId)
            .in("status", ["approved", "pending"])
            .select("*, item:items(id, title)")
            .single();
          if (rental) {
            await admin
              .from("items")
              .update({ availability_status: "rented" })
              .eq("id", rental.item_id);
            await createNotification(
              admin,
              rental.owner_id,
              "rental_confirmed",
              "Booking confirmed",
              `"${rental.item?.title}" was booked and paid for.`,
              rentalId
            );
          }
        }
        break;
      }

      case "payment_intent.amount_capturable_updated": {
        // Deposit hold authorized.
        const intent = event.data.object;
        const rentalId = Number(intent.metadata.rental_id);
        if (rentalId && intent.metadata.kind === "deposit") {
          await admin
            .from("rentals")
            .update({ deposit_status: "held" })
            .eq("id", rentalId)
            .eq("deposit_status", "pending");
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        const rentalId = Number(intent.metadata.rental_id);
        const renterId = Number(intent.metadata.renter_id);
        if (rentalId && renterId) {
          await createNotification(
            admin,
            renterId,
            "message",
            "Payment failed",
            "Your payment could not be processed. Please try a different payment method.",
            rentalId
          );
        }
        break;
      }

      case "identity.verification_session.verified": {
        const session = event.data.object;
        const userId = Number(session.metadata?.renthub_user_id);
        if (userId) {
          const { data: updated } = await admin
            .from("users")
            .update({ id_verified: true, id_verified_at: new Date().toISOString() })
            .eq("id", userId)
            .eq("id_verified", false)
            .select("id");
          if (updated && updated.length > 0) {
            await createNotification(
              admin,
              userId,
              "message",
              "Government ID verified ✓",
              "Your trust score went up by 30 points. You're now a fully verified member."
            );
          }
        }
        break;
      }

      case "identity.verification_session.requires_input": {
        const session = event.data.object;
        const userId = Number(session.metadata?.renthub_user_id);
        if (userId) {
          await createNotification(
            admin,
            userId,
            "message",
            "ID verification needs attention",
            `Verification didn't complete${session.last_error?.reason ? `: ${session.last_error.reason}` : ""}. You can try again from Settings.`
          );
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const intentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (intentId) {
          await admin
            .from("rentals")
            .update({ deposit_status: "refunded" })
            .eq("deposit_payment_intent_id", intentId)
            .eq("deposit_status", "held");
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
