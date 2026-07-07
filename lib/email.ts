import { createNotification } from "@/lib/api-helpers";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { NotificationType } from "@/types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const FROM = process.env.EMAIL_FROM ?? "RentHub <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface SendArgs {
  /** public.users id of the recipient */
  userId: number;
  /** in-app notification type */
  notificationType: NotificationType;
  subject: string;
  /** short plain-text body (also used for the in-app notification message) */
  body: string;
  /** stable idempotency key so webhook retries don't double-send */
  dedupeKey: string;
  /** deep link path within the app (e.g. /rental/12) */
  linkPath?: string;
  relatedRentalId?: number;
  /** in-app notification title (defaults to subject) */
  title?: string;
}

/**
 * Sends a transactional email AND creates the paired in-app notification.
 *
 * - Server-only: the Resend key never reaches the browser.
 * - Idempotent: `email_events.dedupe_key` is UNIQUE; a duplicate (e.g. a
 *   redelivered Stripe webhook) claims the row first and skips the send.
 * - Honors `users.email_notifications` for the EMAIL only — the in-app
 *   notification is always created (it's the user's record of events).
 * - Never fails the caller: email/notification problems are logged, not thrown.
 * - No sensitive URLs (evidence, signed links) are ever embedded.
 */
export async function sendTransactional(admin: Admin, args: SendArgs): Promise<void> {
  // Always create the in-app notification (deduping handled by callers where
  // the trigger itself is idempotent; the notification is cheap and safe).
  try {
    await createNotification(
      admin,
      args.userId,
      args.notificationType,
      args.title ?? args.subject,
      args.body,
      args.relatedRentalId
    );
  } catch (err) {
    console.error("[email] notification create failed:", err);
  }

  // Claim the dedupe key up front — if it already exists, this event was
  // already emailed, so we skip.
  const { error: claimError } = await admin
    .from("email_events")
    .insert({
      dedupe_key: args.dedupeKey,
      recipient: String(args.userId),
      template: args.notificationType,
      status: "pending",
    });
  if (claimError) return; // duplicate key → already sent

  const { data: recipient } = await admin
    .from("users")
    .select("email, name, email_notifications")
    .eq("id", args.userId)
    .single();

  if (!recipient?.email || recipient.email_notifications === false) {
    await admin
      .from("email_events")
      .update({ status: "skipped" })
      .eq("dedupe_key", args.dedupeKey);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const link = args.linkPath ? `${APP_URL}${args.linkPath}` : APP_URL;
  const html = renderEmail(recipient.name ?? "there", args.subject, args.body, link);

  if (!apiKey) {
    // Dev mode — no provider configured. Log instead of sending.
    console.log(
      `[email:DEV] to=${recipient.email} subject="${args.subject}" link=${link}`
    );
    await admin
      .from("email_events")
      .update({ status: "dev_logged" })
      .eq("dedupe_key", args.dedupeKey);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [recipient.email],
        subject: args.subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      await admin
        .from("email_events")
        .update({ status: "error", error: text.slice(0, 500) })
        .eq("dedupe_key", args.dedupeKey);
      console.error("[email] Resend send failed:", res.status, text.slice(0, 300));
      return;
    }
    await admin
      .from("email_events")
      .update({ status: "sent" })
      .eq("dedupe_key", args.dedupeKey);
  } catch (err) {
    await admin
      .from("email_events")
      .update({ status: "error", error: String(err).slice(0, 500) })
      .eq("dedupe_key", args.dedupeKey);
    console.error("[email] send threw:", err);
  }
}

function renderEmail(name: string, subject: string, body: string, link: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;padding:24px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
      <span style="display:inline-flex;width:32px;height:32px;align-items:center;justify-content:center;background:#10b981;color:#fff;border-radius:10px;font-weight:700">R</span>
      <span style="font-weight:700;color:#0f172a;font-size:18px">RentHub</span>
    </div>
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">Hi ${escapeHtml(name)},</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">${escapeHtml(body)}</p>
    <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:10px 20px;border-radius:12px;font-weight:600;font-size:14px">Open RentHub</a>
    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0">You can manage email preferences in your RentHub settings.</p>
  </div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
