-- RentHub row-level security policies
-- Run AFTER schema.sql in the Supabase SQL Editor.
--
-- SECURITY MODEL (Phase 1 hardening):
-- All privileged WRITES go through API routes using the service-role key,
-- which performs its own authorization + validation. Direct client writes via
-- PostgREST are REVOKED entirely — the anon/authenticated roles get SELECT
-- only. This closes the "PostgREST is a second front door" hole where a user
-- could forge id_verified, ratings, rental status, deposits, etc.
--
-- RLS SELECT policies still scope what the browser + realtime can READ.

-- Close the direct-write door for anon + authenticated.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

-- Helper: resolve the current auth user to their public.users id.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

-- USERS: a client may read ONLY its own row (email, phone, verification
-- session id, etc. must never leak). Public profile data is served through
-- API DTOs (GET /api/users/[id]) that select only safe columns.
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth_id = auth.uid());

-- ITEMS: browsable by all (public marketplace listings).
CREATE POLICY items_select_all ON items
  FOR SELECT USING (true);

-- ITEM PHOTOS: readable by all.
CREATE POLICY item_photos_select_all ON item_photos
  FOR SELECT USING (true);

-- RENTALS: only the renter or owner may read (realtime rental updates).
CREATE POLICY rentals_select_own ON rentals
  FOR SELECT USING (
    renter_id = public.current_user_id() OR owner_id = public.current_user_id()
  );

-- MESSAGES: participants only (realtime chat delivery).
CREATE POLICY messages_select_own ON messages
  FOR SELECT USING (
    sender_id = public.current_user_id() OR recipient_id = public.current_user_id()
  );

-- NOTIFICATIONS: recipient only (realtime notifications).
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (user_id = public.current_user_id());

-- DISPUTES: participants of the rental only.
CREATE POLICY disputes_select_own ON disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rentals r WHERE r.id = rental_id AND
      (r.renter_id = public.current_user_id() OR r.owner_id = public.current_user_id()))
  );

-- SAVED ITEMS: private wishlist per user.
CREATE POLICY saved_items_select_own ON saved_items
  FOR SELECT USING (user_id = public.current_user_id());

-- INSURANCE CLAIMS: parties of the rental only.
CREATE POLICY claims_select_own ON insurance_claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rentals r WHERE r.id = rental_id AND
      (r.renter_id = public.current_user_id() OR r.owner_id = public.current_user_id()))
  );

-- FRAUD FLAGS: no client access at all (service-role only).

-- ===== Durable rate limiting (used by API routes via service role) =====
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT, p_limit INT, p_window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed BOOLEAN;
BEGIN
  INSERT INTO rate_limits AS r (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds)
                 THEN 1 ELSE r.count + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds)
                        THEN now() ELSE r.window_start END
  RETURNING count <= p_limit INTO allowed;
  RETURN allowed;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT)
  FROM PUBLIC, anon, authenticated;

-- ===== Stripe webhook dedupe / failure log =====
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ===== Database-level double-booking guard =====
-- No two approved/confirmed/active rentals for the same item may overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_no_overlap;
ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap
  EXCLUDE USING gist (
    item_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status IN ('approved','confirmed','active'));

-- ===== Storage note =====
-- The condition-photos bucket must be PRIVATE (evidence photos). Set it in
-- the dashboard or: UPDATE storage.buckets SET public = false WHERE id = 'condition-photos';
-- Evidence is served via short-lived signed URLs by the API to authorized parties.
