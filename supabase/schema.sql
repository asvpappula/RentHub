-- RentHub database schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

CREATE TABLE users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  -- Links this profile row to Supabase Auth (auth.users). Required so the app
  -- can resolve the logged-in session to a profile.
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  bio TEXT,
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  id_verified BOOLEAN DEFAULT FALSE,
  id_verified_at TIMESTAMP,
  stripe_verification_session_id VARCHAR(255),
  terms_accepted_at TIMESTAMP,
  background_check_status VARCHAR(50) DEFAULT 'pending',
  average_rating DECIMAL(3,2),
  total_reviews INT DEFAULT 0,
  total_rentals INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  owner_id BIGINT NOT NULL REFERENCES users(id),
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  condition VARCHAR(50) DEFAULT 'good',
  daily_rate INT NOT NULL,
  deposit_amount INT NOT NULL,
  insurance_fee_percentage DECIMAL(3,2) DEFAULT 5,
  availability_status VARCHAR(50) DEFAULT 'available',
  gps_tracking_required BOOLEAN DEFAULT FALSE,
  delivery_options VARCHAR(255),
  view_count INT DEFAULT 0,
  rental_count INT DEFAULT 0,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE item_photos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'main',
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rentals (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  renter_id BIGINT NOT NULL REFERENCES users(id),
  owner_id BIGINT NOT NULL REFERENCES users(id),
  item_id BIGINT NOT NULL REFERENCES items(id),
  status VARCHAR(50) DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate INT NOT NULL,
  number_of_days INT NOT NULL,
  insurance_fee INT NOT NULL,
  deposit_amount INT NOT NULL,
  total_cost INT NOT NULL,
  payment_intent_id VARCHAR(255),
  deposit_payment_intent_id VARCHAR(255),
  deposit_status VARCHAR(50) DEFAULT 'pending',
  agreement_accepted_at TIMESTAMP,
  renter_rating INT,
  owner_rating INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  recipient_id BIGINT NOT NULL REFERENCES users(id),
  rental_id BIGINT REFERENCES rentals(id),
  content TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_rental_id BIGINT REFERENCES rentals(id),
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE disputes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  rental_id BIGINT NOT NULL REFERENCES rentals(id),
  dispute_type VARCHAR(50) NOT NULL,
  reported_by BIGINT NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  evidence_photos TEXT[] DEFAULT '{}',
  response TEXT,
  resolution_notes TEXT,
  appeal_reason TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE saved_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE insurance_claims (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  rental_id BIGINT NOT NULL REFERENCES rentals(id),
  claimant_id BIGINT NOT NULL REFERENCES users(id),
  claim_type VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  estimated_value INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Service-role only (RLS enabled with no policies).
CREATE TABLE phone_verification_codes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  attempts INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE fraud_flags (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  rule VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_saved_items_user ON saved_items(user_id);
CREATE INDEX idx_phone_codes_user ON phone_verification_codes(user_id);
CREATE INDEX idx_claims_rental ON insurance_claims(rental_id);
CREATE INDEX idx_items_owner ON items(owner_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_rentals_renter ON rentals(renter_id);
CREATE INDEX idx_rentals_owner ON rentals(owner_id);
CREATE INDEX idx_rentals_item ON rentals(item_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Auto-create a profile row whenever a Supabase Auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (email) DO UPDATE SET auth_id = EXCLUDED.auth_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER items_touch BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rentals_touch BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime for live messaging / notifications / rental updates.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE rentals;
