# RentHub — Supabase & Stripe setup

Follow these steps once, then paste your keys into `.env.local` (copy from
`.env.example` in the project root).

## 1. Create the Supabase project

1. Go to <https://supabase.com> → New project, name it **renthub**, US region.
2. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)

## 2. Run the SQL

In **SQL Editor**, run in order:

1. [`schema.sql`](./schema.sql) — tables, indexes, triggers, realtime publication.
   Note: it adds one column beyond the original spec — `users.auth_id UUID`
   referencing `auth.users`, plus a signup trigger — so app profiles link to
   Supabase Auth accounts automatically.
2. [`rls-policies.sql`](./rls-policies.sql) — row-level security for all tables.

## 3. Storage buckets

**Storage → New bucket** (mark each *Public*):

- `item-photos`
- `condition-photos`
- `profile-photos`

Add a storage policy on each bucket allowing authenticated users to upload:
`(auth.role() = 'authenticated')` for INSERT.

## 4. Authentication

- **Authentication → Providers**: Email is enabled by default (keep "Confirm
  email" ON so users must verify).
- Optional Google OAuth: create OAuth credentials in Google Cloud Console with
  redirect URL `https://<your-project>.supabase.co/auth/v1/callback`, then
  paste client ID/secret into the Google provider.
- **Authentication → URL Configuration**: set Site URL to your app URL
  (`http://localhost:3000` in dev) so email links redirect correctly.

## 5. Realtime

`schema.sql` already adds `messages`, `notifications`, and `rentals` to the
`supabase_realtime` publication. Verify under **Database → Replication**.

## 6. Stripe

1. Sign up at <https://stripe.com> (test mode is fine).
2. **Developers → API keys**: copy the publishable key →
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and secret key → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**: `https://<your-app>/api/webhooks/stripe`
   listening to `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `charge.refunded`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
   For local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline),
`4000 0025 0000 3155` (3-D Secure).

## 7. Vercel

Import the GitHub repo at <https://vercel.com>, set every variable from
`.env.example` in Project → Settings → Environment Variables, and deploy.
