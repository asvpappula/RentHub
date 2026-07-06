-- RentHub row-level security policies
-- Run AFTER schema.sql in the Supabase SQL Editor.
--
-- The app's API routes use the service-role key (which bypasses RLS) after
-- performing their own authorization checks; these policies protect direct
-- client access (browser reads + realtime subscriptions).

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

-- USERS: public profiles are readable; only the owner can change their row.
CREATE POLICY users_select_public ON users
  FOR SELECT USING (true);
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth_id = auth.uid());
CREATE POLICY users_delete_own ON users
  FOR DELETE USING (auth_id = auth.uid());

-- ITEMS: anyone can browse; owners manage their own listings.
CREATE POLICY items_select_all ON items
  FOR SELECT USING (true);
CREATE POLICY items_insert_own ON items
  FOR INSERT WITH CHECK (owner_id = public.current_user_id());
CREATE POLICY items_update_own ON items
  FOR UPDATE USING (owner_id = public.current_user_id());
CREATE POLICY items_delete_own ON items
  FOR DELETE USING (owner_id = public.current_user_id());

-- ITEM PHOTOS: readable by all; managed by the item owner.
CREATE POLICY item_photos_select_all ON item_photos
  FOR SELECT USING (true);
CREATE POLICY item_photos_write_own ON item_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM items WHERE items.id = item_id
            AND items.owner_id = public.current_user_id())
  );
CREATE POLICY item_photos_delete_own ON item_photos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM items WHERE items.id = item_id
            AND items.owner_id = public.current_user_id())
  );

-- RENTALS: only the renter or owner may see/update; renters create.
CREATE POLICY rentals_select_own ON rentals
  FOR SELECT USING (
    renter_id = public.current_user_id() OR owner_id = public.current_user_id()
  );
CREATE POLICY rentals_insert_renter ON rentals
  FOR INSERT WITH CHECK (renter_id = public.current_user_id());
CREATE POLICY rentals_update_own ON rentals
  FOR UPDATE USING (
    renter_id = public.current_user_id() OR owner_id = public.current_user_id()
  );

-- MESSAGES: participants only.
CREATE POLICY messages_select_own ON messages
  FOR SELECT USING (
    sender_id = public.current_user_id() OR recipient_id = public.current_user_id()
  );
CREATE POLICY messages_insert_sender ON messages
  FOR INSERT WITH CHECK (sender_id = public.current_user_id());
CREATE POLICY messages_update_recipient ON messages
  FOR UPDATE USING (recipient_id = public.current_user_id());

-- NOTIFICATIONS: recipient only.
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (user_id = public.current_user_id());
CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE USING (user_id = public.current_user_id());

-- DISPUTES: participants of the rental only.
CREATE POLICY disputes_select_own ON disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rentals r WHERE r.id = rental_id AND
      (r.renter_id = public.current_user_id() OR r.owner_id = public.current_user_id()))
  );
CREATE POLICY disputes_insert_participant ON disputes
  FOR INSERT WITH CHECK (
    reported_by = public.current_user_id() AND
    EXISTS (SELECT 1 FROM rentals r WHERE r.id = rental_id AND
      (r.renter_id = public.current_user_id() OR r.owner_id = public.current_user_id()))
  );

-- FRAUD FLAGS: service-role only (no client policies on purpose).
