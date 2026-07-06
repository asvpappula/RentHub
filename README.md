# RentHub

Peer-to-peer rental marketplace — rent tools, cameras, gear, and more from
verified neighbors. Insured, deposit-protected, with real-time messaging.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Storage, Realtime) · Stripe**.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Stripe keys
npm run dev                  # http://localhost:3000
```

Backend setup (Supabase project, SQL, buckets, Stripe webhook):
see **[supabase/README.md](supabase/README.md)**.
`.env.local` ships with placeholder values so the app builds and the UI can be
explored before the backend is configured.

## Features

- **Auth** — email/password + Google OAuth via Supabase Auth, email
  verification, protected routes (middleware), password reset
- **Listings** — create items with photos (Supabase Storage), category /
  price / text search with pagination and sorting
- **Rentals** — request → owner approve/reject → checkout → active →
  complete lifecycle, with overlap-prevention and fraud screening
- **Payments** — Stripe Elements checkout (rental + 5% insurance), deposit
  **escrow via manual-capture holds** (release = cancel, claim = capture),
  webhook reconciliation
- **Realtime** — live messaging with read receipts, live notifications with
  unread badge, live rental status updates (Supabase Realtime)
- **Trust & safety** — RLS policies on every table, Zod input validation,
  rate limiting, rule-based fraud flags, disputes (damage/theft reports),
  two-way ratings

## Project layout

```
app/                  Pages (App Router) + API routes under app/api/
components/           UI library (Button, Modal, Toast…) + domain components
contexts/             AuthContext (useAuth)
hooks/                useMessages, useNotifications, useRentalUpdates
lib/                  Supabase/Stripe clients, validation, helpers, fraud rules
supabase/             schema.sql, rls-policies.sql, setup README
middleware.ts         Session refresh + route protection
```

## Deploy

Push to GitHub → import in Vercel → set the env vars from `.env.example` →
deploy. Point the Stripe webhook at `https://<domain>/api/webhooks/stripe`
and set the Supabase Site URL to your domain.
