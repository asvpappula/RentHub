import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeServer } from "@/lib/stripe-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/api-helpers";
import { finalizeRentalConfirmation } from "@/lib/rental-confirmation";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // Fail safe: never process an event we can't cryptographically verify.
  if (!secret || secret === "whsec_placeholder") {
    console.error(
      "[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured — rejecting event. " +
        "Set a real signing secret from the Stripe dashboard."
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const stripe = getStripeServer();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Idempotency / replay protection: claim the event id atomically. If it
  // already exists we've seen it — ack and skip.
  const { error: dedupeError } = await admin
    .from("webhook_events")
    .insert({ event_id: event.id, type: event.type, status: "processing" });
  if (dedupeError) {
    // Primary-key conflict → duplicate delivery. Any other error → log + ack.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const rentalId = Number(intent.metadata.rental_id);
        if (!rentalId) break;

        if (intent.metadata.kind === "deposit") {
          // A captured deposit (claim) — the claim/resolve flow already sets
          // deposit_status; nothing to do on plain success here.
          break;
        }

        // Rental payment succeeded → run the server-side confirmation gate,
        // which places the deposit hold and only then confirms.
        const { data: rental } = await admin
          .from("rentals")
          .select("*, item:items(id, title)")
          .eq("id", rentalId)
          .single();
        if (rental) await finalizeRentalConfirmation(admin, stripe, rental);
        break;
      }

      case "payment_intent.amount_capturable_updated": {
        const intent = event.data.object;
        const rentalId = Number(intent.metadata.rental_id);
        if (rentalId && intent.metadata.kind === "deposit") {
          await admin
            .from("rentals")
            .update({ deposit_status: "held" })
            .eq("id", rentalId)
            .in("deposit_status", ["pending", "processing"]);
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

      case "charge.dispute.created": {
        // Chargeback opened — flag the rental for admin review (Phase 3).
        const dispute = event.data.object;
        const intentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;
        if (intentId) {
          const { data: rental } = await admin
            .from("rentals")
            .select("id, renter_id, owner_id")
            .or(
              `payment_intent_id.eq.${intentId},deposit_payment_intent_id.eq.${intentId}`
            )
            .maybeSingle();
          if (rental) {
            await admin.from("rentals").update({ status: "disputed" }).eq("id", rental.id);
            for (const uid of [rental.owner_id, rental.renter_id]) {
              await createNotification(
                admin,
                uid,
                "dispute",
                "Payment dispute opened",
                "A card chargeback was opened on this rental. RentHub will review it."
              );
            }
          }
        }
        break;
      }
    }

    await admin
      .from("webhook_events")
      .update({ status: "processed" })
      .eq("event_id", event.id);
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
    await admin
      .from("webhook_events")
      .update({ status: "error", error: String(err) })
      .eq("event_id", event.id);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
