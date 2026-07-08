-- Phase 4: pickup/return handoff + evidence + incidents
-- Idempotent — safe to re-run. Apply after schema.sql + rls-policies.sql.

-- rentals: pickup + return handoff / evidence fields
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(12);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMPTZ;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_confirmed_by BIGINT REFERENCES users(id);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_photos TEXT[] DEFAULT '{}';
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_notes TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pickup_accessories JSONB DEFAULT '[]';
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_submitted_at TIMESTAMPTZ;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_submitted_by BIGINT REFERENCES users(id);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_photos TEXT[] DEFAULT '{}';
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_notes TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_reviewed_at TIMESTAMPTZ;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_reviewed_by BIGINT REFERENCES users(id);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_status VARCHAR(20) DEFAULT 'none';

-- items: PRIVATE serial/identifier + accessory checklist definition
ALTER TABLE items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(120);
ALTER TABLE items ADD COLUMN IF NOT EXISTS accessories TEXT[] DEFAULT '{}';

-- booking_state_events: immutable audit of every rental transition.
CREATE TABLE IF NOT EXISTS booking_state_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  rental_id BIGINT NOT NULL REFERENCES rentals(id),
  event_type VARCHAR(50) NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  actor_user_id BIGINT REFERENCES users(id),
  actor_role VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- incidents: structured handoff problems (late/damage/missing/theft/etc).
CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  rental_id BIGINT NOT NULL REFERENCES rentals(id),
  opened_by BIGINT NOT NULL REFERENCES users(id),
  against_user_id BIGINT REFERENCES users(id),
  type VARCHAR(30) NOT NULL,
  status VARCHAR(30) DEFAULT 'open',
  description TEXT NOT NULL,
  evidence TEXT[] DEFAULT '{}',
  resolution_notes TEXT,
  resolved_by BIGINT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_rental ON booking_state_events(rental_id);
CREATE INDEX IF NOT EXISTS idx_incidents_rental ON incidents(rental_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Deny-all for clients: RLS on, no policies → all access via service-role API.
ALTER TABLE booking_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_state_events FROM anon, authenticated;
REVOKE ALL ON incidents FROM anon, authenticated;

-- Keep incidents.updated_at fresh (touch_updated_at defined in schema.sql).
DROP TRIGGER IF EXISTS incidents_touch ON incidents;
CREATE TRIGGER incidents_touch BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
