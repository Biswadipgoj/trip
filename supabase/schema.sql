-- ============================================================================
-- TRIP EXPENSE MANAGER — Supabase Database Setup
-- Run this entire file in your Supabase SQL Editor (single execution)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE trip_status      AS ENUM ('active', 'closed');
CREATE TYPE payment_status   AS ENUM ('pending', 'paid', 'confirmed');
CREATE TYPE expense_category AS ENUM (
  'food', 'travel', 'stay', 'entertainment',
  'shopping', 'alcohol', 'fuel', 'tickets', 'misc'
);
CREATE TYPE split_type AS ENUM (
  'equal', 'custom', 'percentage', 'quantity', 'room'
);

-- ============================================================================
-- TABLE: trips
-- ============================================================================

CREATE TABLE trips (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_code    TEXT         NOT NULL UNIQUE,          -- e.g. TRP-4X9Z
  name         TEXT         NOT NULL,
  password     TEXT         NOT NULL,                 -- plain text (demo mode); use bcrypt in prod
  creator_id   UUID,                                  -- FK set after first member insert
  status       trip_status  NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at    TIMESTAMPTZ
);

CREATE INDEX idx_trips_trip_code ON trips (trip_code);

-- ============================================================================
-- TABLE: members
-- ============================================================================

CREATE TABLE members (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  mobile        TEXT        NOT NULL,
  pin           TEXT        NOT NULL,                 -- 4-digit PIN (plain; hash in prod)
  upi_id        TEXT,
  upi_name      TEXT,
  avatar_color  TEXT        NOT NULL DEFAULT 'hsl(240, 78%, 58%)',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(trip_id, mobile)
);

CREATE INDEX idx_members_trip_id ON members (trip_id);

-- Add FK from trips.creator_id → members after members table exists
ALTER TABLE trips
  ADD CONSTRAINT fk_trips_creator
    FOREIGN KEY (creator_id) REFERENCES members(id) ON DELETE SET NULL;

-- ============================================================================
-- TABLE: expenses
-- ============================================================================

CREATE TABLE expenses (
  id          UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID             NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title       TEXT             NOT NULL,
  amount      NUMERIC(12, 2)   NOT NULL CHECK (amount > 0),
  paid_by     UUID             NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category    expense_category NOT NULL DEFAULT 'misc',
  split_type  split_type       NOT NULL DEFAULT 'equal',
  notes       TEXT,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_trip_id   ON expenses (trip_id);
CREATE INDEX idx_expenses_paid_by   ON expenses (paid_by);
CREATE INDEX idx_expenses_created   ON expenses (created_at DESC);

-- ============================================================================
-- TABLE: expense_participants
-- Which members share a given expense
-- ============================================================================

CREATE TABLE expense_participants (
  id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id  UUID           NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id   UUID           NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Split data (only relevant for non-equal split types)
  split_value          NUMERIC(12, 4) DEFAULT 0,   -- raw value (amount / pct / qty)
  resolved_amount      NUMERIC(12, 2) DEFAULT 0,   -- final calculated share

  UNIQUE(expense_id, member_id)
);

CREATE INDEX idx_expense_participants_expense ON expense_participants (expense_id);
CREATE INDEX idx_expense_participants_member  ON expense_participants (member_id);

-- ============================================================================
-- TABLE: hotel_expenses
-- A hotel booking that contains multiple rooms
-- ============================================================================

CREATE TABLE hotel_expenses (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id      UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title        TEXT           NOT NULL,              -- e.g. "Goa Beach Resort"
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  paid_by      UUID           NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hotel_expenses_trip_id ON hotel_expenses (trip_id);

-- ============================================================================
-- TABLE: rooms
-- Individual rooms within a hotel booking
-- ============================================================================

CREATE TABLE rooms (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_expense_id UUID           NOT NULL REFERENCES hotel_expenses(id) ON DELETE CASCADE,
  trip_id          UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name             TEXT           NOT NULL,          -- e.g. "Room A", "Deluxe Suite"
  cost             NUMERIC(12, 2) NOT NULL CHECK (cost >= 0)
);

CREATE INDEX idx_rooms_hotel_expense ON rooms (hotel_expense_id);

-- ============================================================================
-- TABLE: room_occupants
-- Which members stay in a given room
-- ============================================================================

CREATE TABLE room_occupants (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  UNIQUE(room_id, member_id)
);

CREATE INDEX idx_room_occupants_room   ON room_occupants (room_id);
CREATE INDEX idx_room_occupants_member ON room_occupants (member_id);

-- ============================================================================
-- TABLE: settlement_groups
-- Multiple members treated as one financial entity at settlement time
-- Does NOT affect individual expense participation
-- ============================================================================

CREATE TABLE settlement_groups (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id  UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name     TEXT NOT NULL                              -- e.g. "Rahul & Priya"
);

CREATE INDEX idx_settlement_groups_trip ON settlement_groups (trip_id);

-- ============================================================================
-- TABLE: settlement_group_members
-- Members belonging to a settlement group
-- ============================================================================

CREATE TABLE settlement_group_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES settlement_groups(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  UNIQUE(group_id, member_id)
);

CREATE INDEX idx_sgm_group  ON settlement_group_members (group_id);
CREATE INDEX idx_sgm_member ON settlement_group_members (member_id);

-- ============================================================================
-- TABLE: sponsorships
-- Sponsor absorbs sponsored member's final balance at settlement
-- Sponsored member still participates individually in all expenses
-- ============================================================================

CREATE TABLE sponsorships (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id              UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sponsor_member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sponsored_member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Prevent duplicates and self-sponsorship
  CONSTRAINT no_self_sponsorship CHECK (sponsor_member_id <> sponsored_member_id),
  UNIQUE(trip_id, sponsor_member_id, sponsored_member_id)
);

CREATE INDEX idx_sponsorships_trip     ON sponsorships (trip_id);
CREATE INDEX idx_sponsorships_sponsor  ON sponsorships (sponsor_member_id);
CREATE INDEX idx_sponsorships_sponsored ON sponsorships (sponsored_member_id);

-- ============================================================================
-- TABLE: settlements
-- Final calculated settlement routes (who pays whom how much)
-- Re-generated whenever expenses/groups/sponsorships change
-- ============================================================================

CREATE TABLE settlements (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id         UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_member_id  UUID           NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member_id    UUID           NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status          payment_status NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_settlement CHECK (from_member_id <> to_member_id)
);

CREATE INDEX idx_settlements_trip        ON settlements (trip_id);
CREATE INDEX idx_settlements_from_member ON settlements (from_member_id);
CREATE INDEX idx_settlements_to_member   ON settlements (to_member_id);
CREATE INDEX idx_settlements_status      ON settlements (status);

-- ============================================================================
-- FUNCTION: auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEW: member_balances
-- Computes each member's net balance across all expenses in a trip.
-- NOTE: This view handles EQUAL splits only.
-- For custom/percentage/quantity splits, use expense_participants.resolved_amount.
-- ============================================================================

CREATE OR REPLACE VIEW member_balances AS
WITH
  -- Amount each member paid across all expenses
  paid AS (
    SELECT trip_id, paid_by AS member_id, SUM(amount) AS total_paid
    FROM expenses
    GROUP BY trip_id, paid_by
  ),
  -- Amount each member owes via expense_participants
  owed_regular AS (
    SELECT e.trip_id, ep.member_id, SUM(ep.resolved_amount) AS total_owed
    FROM expense_participants ep
    JOIN expenses e ON e.id = ep.expense_id
    GROUP BY e.trip_id, ep.member_id
  ),
  -- Amount paid for hotel bookings
  hotel_paid AS (
    SELECT trip_id, paid_by AS member_id, SUM(total_amount) AS total_paid
    FROM hotel_expenses
    GROUP BY trip_id, paid_by
  ),
  -- Amount owed via room occupancy (cost / occupants per room)
  hotel_owed AS (
    SELECT
      h.trip_id,
      ro.member_id,
      SUM(r.cost::NUMERIC / NULLIF(occ.cnt, 0)) AS total_owed
    FROM room_occupants ro
    JOIN rooms r ON r.id = ro.room_id
    JOIN hotel_expenses h ON h.id = r.hotel_expense_id
    JOIN (
      SELECT room_id, COUNT(*) AS cnt FROM room_occupants GROUP BY room_id
    ) occ ON occ.room_id = ro.room_id
    WHERE occ.cnt > 0
    GROUP BY h.trip_id, ro.member_id
  )
SELECT
  m.id            AS member_id,
  m.trip_id,
  m.name,
  m.avatar_color,
  COALESCE(p.total_paid, 0) + COALESCE(hp.total_paid, 0)  AS total_paid,
  COALESCE(or_.total_owed, 0) + COALESCE(ho.total_owed, 0) AS total_owed,
  (COALESCE(p.total_paid, 0) + COALESCE(hp.total_paid, 0))
    - (COALESCE(or_.total_owed, 0) + COALESCE(ho.total_owed, 0)) AS net_balance
FROM members m
LEFT JOIN paid         p   ON p.member_id  = m.id AND p.trip_id   = m.trip_id
LEFT JOIN owed_regular or_ ON or_.member_id = m.id AND or_.trip_id = m.trip_id
LEFT JOIN hotel_paid   hp  ON hp.member_id  = m.id AND hp.trip_id  = m.trip_id
LEFT JOIN hotel_owed   ho  ON ho.member_id  = m.id AND ho.trip_id  = m.trip_id;

-- ============================================================================
-- VIEW: trip_summary
-- High-level stats per trip (pre-aggregated CTEs prevent cartesian multiplication & sum deduplication bugs)
-- ============================================================================

CREATE OR REPLACE VIEW trip_summary AS
WITH
  exp_stats AS (
    SELECT
      trip_id,
      COUNT(*)::INT AS expense_count,
      COALESCE(SUM(amount), 0) AS total_expense_amount
    FROM expenses
    GROUP BY trip_id
  ),
  hotel_stats AS (
    SELECT
      trip_id,
      COUNT(*)::INT AS hotel_count,
      COALESCE(SUM(total_amount), 0) AS total_hotel_amount
    FROM hotel_expenses
    GROUP BY trip_id
  ),
  member_stats AS (
    SELECT
      trip_id,
      COUNT(*)::INT AS member_count
    FROM members
    GROUP BY trip_id
  ),
  settle_stats AS (
    SELECT
      trip_id,
      COUNT(*)::INT AS total_settlements,
      COUNT(*) FILTER (WHERE status = 'confirmed')::INT AS confirmed_settlements
    FROM settlements
    GROUP BY trip_id
  )
SELECT
  t.id                                                  AS trip_id,
  t.name                                                AS trip_name,
  t.trip_code,
  t.status,
  t.created_at,
  t.closed_at,
  COALESCE(ms.member_count, 0)                          AS member_count,
  COALESCE(es.expense_count, 0)                         AS expense_count,
  COALESCE(es.total_expense_amount, 0)                  AS total_expense_amount,
  COALESCE(hs.total_hotel_amount, 0)                    AS total_hotel_amount,
  COALESCE(es.total_expense_amount, 0)
    + COALESCE(hs.total_hotel_amount, 0)                AS grand_total,
  COALESCE(ss.confirmed_settlements, 0)                 AS confirmed_settlements,
  COALESCE(ss.total_settlements, 0)                     AS total_settlements
FROM trips t
LEFT JOIN member_stats ms ON ms.trip_id = t.id
LEFT JOIN exp_stats    es ON es.trip_id = t.id
LEFT JOIN hotel_stats  hs ON hs.trip_id = t.id
LEFT JOIN settle_stats ss ON ss.trip_id = t.id;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables. Use anon key + trip_code for access control.
-- The app uses a custom auth model (trip code + mobile + PIN),
-- so we allow all anon operations here and rely on app-level validation.
-- In production, consider proper Supabase Auth integration.
-- ============================================================================

ALTER TABLE trips                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_occupants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements             ENABLE ROW LEVEL SECURITY;

-- Allow all operations from the anon (public) role
-- (Replace with proper policies when adding Supabase Auth)

CREATE POLICY "allow_all_trips"                    ON trips                    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_members"                  ON members                  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_expenses"                 ON expenses                 FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_expense_participants"     ON expense_participants      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_hotel_expenses"           ON hotel_expenses            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rooms"                    ON rooms                    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_room_occupants"           ON room_occupants            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settlement_groups"        ON settlement_groups         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settlement_group_members" ON settlement_group_members  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sponsorships"             ON sponsorships              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settlements"              ON settlements               FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- Enable Supabase Realtime for live UI updates across devices
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE hotel_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_occupants;
ALTER PUBLICATION supabase_realtime ADD TABLE settlement_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE settlement_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE sponsorships;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;

-- ============================================================================
-- SEED DATA (Optional — for testing)
-- Uncomment to create a sample trip with 4 members and 3 expenses
-- ============================================================================

/*
DO $$
DECLARE
  v_trip_id   UUID;
  v_member_rahul UUID;
  v_member_priya UUID;
  v_member_amit  UUID;
  v_member_dip   UUID;
  v_expense_1    UUID;
  v_expense_2    UUID;
  v_hotel_id     UUID;
  v_room_a       UUID;
  v_room_b       UUID;
BEGIN

  -- Create trip
  INSERT INTO trips (trip_code, name, password, status)
  VALUES ('TRP-DEMO', 'Goa Trip 2025', 'goa123', 'active')
  RETURNING id INTO v_trip_id;

  -- Create members
  INSERT INTO members (trip_id, name, mobile, pin, avatar_color)
    VALUES (v_trip_id, 'Rahul', '9876543210', '1234', 'hsl(240, 78%, 58%)')
    RETURNING id INTO v_member_rahul;

  INSERT INTO members (trip_id, name, mobile, pin, avatar_color)
    VALUES (v_trip_id, 'Priya', '9876543211', '1234', 'hsl(280, 78%, 55%)')
    RETURNING id INTO v_member_priya;

  INSERT INTO members (trip_id, name, mobile, pin, avatar_color)
    VALUES (v_trip_id, 'Amit', '9876543212', '1234', 'hsl(340, 75%, 55%)')
    RETURNING id INTO v_member_amit;

  INSERT INTO members (trip_id, name, mobile, pin, avatar_color)
    VALUES (v_trip_id, 'Dip', '9876543213', '1234', 'hsl(25, 80%, 55%)')
    RETURNING id INTO v_member_dip;

  -- Set creator
  UPDATE trips SET creator_id = v_member_rahul WHERE id = v_trip_id;

  -- Expense 1: Dinner (equal split, all members)
  INSERT INTO expenses (trip_id, title, amount, paid_by, category, split_type)
    VALUES (v_trip_id, 'Dinner at Fisherman''s Wharf', 2800, v_member_rahul, 'food', 'equal')
    RETURNING id INTO v_expense_1;

  INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount)
    VALUES
      (v_expense_1, v_member_rahul, 0, 700),
      (v_expense_1, v_member_priya, 0, 700),
      (v_expense_1, v_member_amit,  0, 700),
      (v_expense_1, v_member_dip,   0, 700);

  -- Expense 2: Beer (quantity split — Rahul 4, Amit 6, Dip 2, Priya excluded)
  INSERT INTO expenses (trip_id, title, amount, paid_by, category, split_type)
    VALUES (v_trip_id, 'Beer at Beach Shack', 1200, v_member_amit, 'alcohol', 'quantity')
    RETURNING id INTO v_expense_2;

  INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount)
    VALUES
      (v_expense_2, v_member_rahul, 4, 400),   -- 4/12 * 1200
      (v_expense_2, v_member_amit,  6, 600),   -- 6/12 * 1200
      (v_expense_2, v_member_dip,   2, 200);   -- 2/12 * 1200

  -- Hotel expense: 2 rooms
  INSERT INTO hotel_expenses (trip_id, title, total_amount, paid_by)
    VALUES (v_trip_id, 'Zostel Goa', 6000, v_member_dip)
    RETURNING id INTO v_hotel_id;

  -- Room A: Rahul + Priya + Amit (₹3000)
  INSERT INTO rooms (hotel_expense_id, trip_id, name, cost)
    VALUES (v_hotel_id, v_trip_id, 'Room A', 3000)
    RETURNING id INTO v_room_a;

  INSERT INTO room_occupants (room_id, member_id)
    VALUES (v_room_a, v_member_rahul), (v_room_a, v_member_priya), (v_room_a, v_member_amit);

  -- Room B: Dip (₹3000)
  INSERT INTO rooms (hotel_expense_id, trip_id, name, cost)
    VALUES (v_hotel_id, v_trip_id, 'Room B', 3000)
    RETURNING id INTO v_room_b;

  INSERT INTO room_occupants (room_id, member_id)
    VALUES (v_room_b, v_member_dip);

  RAISE NOTICE 'Seed data created successfully. Trip code: TRP-DEMO';
END $$;
*/

-- ============================================================================
-- HIGH-CONCURRENCY COMPOSITE INDEXES
-- Eliminates table scans on mobile sync & high frequency queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_expenses_trip_created           ON expenses (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_expenses_trip_created     ON hotel_expenses (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_trip_status         ON settlements (trip_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_participants_member_exp ON expense_participants (member_id, expense_id);
CREATE INDEX IF NOT EXISTS idx_members_trip_mobile             ON members (trip_id, mobile);
CREATE INDEX IF NOT EXISTS idx_members_joined                  ON members (trip_id, joined_at ASC);
CREATE INDEX IF NOT EXISTS idx_rooms_trip                      ON rooms (trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_trip_code_upper           ON trips (UPPER(trip_code));
CREATE INDEX IF NOT EXISTS idx_trips_status                    ON trips (status);

-- ============================================================================
-- HIGH-PERFORMANCE RPC: get_trip_bundle
-- Pulls the complete trip data graph in a single query with sub-millisecond execution.
-- Dramatically reduces mobile network latency from 8 HTTP roundtrips to 1.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trip_bundle(p_trip_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_trip FROM trips WHERE UPPER(trip_code) = UPPER(p_trip_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'trip', to_jsonb(v_trip),
    'members', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.joined_at ASC)
      FROM members m WHERE m.trip_id = v_trip.id
    ), '[]'::jsonb),
    'expenses', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(e) || jsonb_build_object(
          'participants', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'member_id', ep.member_id,
              'split_value', ep.split_value,
              'resolved_amount', ep.resolved_amount
            ))
            FROM expense_participants ep
            WHERE ep.expense_id = e.id
          ), '[]'::jsonb)
        )
        ORDER BY e.created_at DESC
      )
      FROM expenses e WHERE e.trip_id = v_trip.id
    ), '[]'::jsonb),
    'hotel_expenses', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(he) || jsonb_build_object(
          'rooms', COALESCE((
            SELECT jsonb_agg(
              to_jsonb(r) || jsonb_build_object(
                'occupant_ids', COALESCE((
                  SELECT jsonb_agg(ro.member_id)
                  FROM room_occupants ro WHERE ro.room_id = r.id
                ), '[]'::jsonb)
              )
            )
            FROM rooms r WHERE r.hotel_expense_id = he.id
          ), '[]'::jsonb)
        )
        ORDER BY he.created_at DESC
      )
      FROM hotel_expenses he WHERE he.trip_id = v_trip.id
    ), '[]'::jsonb),
    'settlement_groups', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(sg) || jsonb_build_object(
          'member_ids', COALESCE((
            SELECT jsonb_agg(sgm.member_id)
            FROM settlement_group_members sgm WHERE sgm.group_id = sg.id
          ), '[]'::jsonb)
        )
      )
      FROM settlement_groups sg WHERE sg.trip_id = v_trip.id
    ), '[]'::jsonb),
    'sponsorships', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
      FROM sponsorships s WHERE s.trip_id = v_trip.id
    ), '[]'::jsonb),
    'settlements', COALESCE((
      SELECT jsonb_agg(to_jsonb(st) ORDER BY st.created_at ASC)
      FROM settlements st WHERE st.trip_id = v_trip.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ATOMIC EXPENSE TRANSACTION: create_expense_with_participants
-- Atomically creates an expense and its participant splits in a single transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_expense_with_participants(
  p_trip_id UUID,
  p_title TEXT,
  p_amount NUMERIC(12, 2),
  p_paid_by UUID,
  p_category expense_category,
  p_split_type split_type,
  p_notes TEXT,
  p_participants JSONB
)
RETURNS UUID AS $$
DECLARE
  v_expense_id UUID;
  v_elem JSONB;
BEGIN
  INSERT INTO expenses (trip_id, title, amount, paid_by, category, split_type, notes)
  VALUES (p_trip_id, p_title, p_amount, p_paid_by, p_category, p_split_type, p_notes)
  RETURNING id INTO v_expense_id;

  IF p_participants IS NOT NULL AND jsonb_array_length(p_participants) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_participants)
    LOOP
      INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount)
      VALUES (
        v_expense_id,
        (v_elem->>'member_id')::UUID,
        COALESCE((v_elem->>'split_value')::NUMERIC, 0),
        COALESCE((v_elem->>'resolved_amount')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ATOMIC HOTEL TRANSACTION: create_hotel_expense_with_rooms
-- Atomically creates hotel booking, rooms, and room occupants in one single transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_hotel_expense_with_rooms(
  p_trip_id UUID,
  p_title TEXT,
  p_total_amount NUMERIC(12, 2),
  p_paid_by UUID,
  p_rooms JSONB
)
RETURNS UUID AS $$
DECLARE
  v_hotel_id UUID;
  v_room_elem JSONB;
  v_room_id UUID;
  v_occ_elem JSONB;
BEGIN
  INSERT INTO hotel_expenses (trip_id, title, total_amount, paid_by)
  VALUES (p_trip_id, p_title, p_total_amount, p_paid_by)
  RETURNING id INTO v_hotel_id;

  IF p_rooms IS NOT NULL AND jsonb_array_length(p_rooms) > 0 THEN
    FOR v_room_elem IN SELECT * FROM jsonb_array_elements(p_rooms)
    LOOP
      INSERT INTO rooms (hotel_expense_id, trip_id, name, cost)
      VALUES (
        v_hotel_id,
        p_trip_id,
        COALESCE(v_room_elem->>'name', 'Room'),
        COALESCE((v_room_elem->>'cost')::NUMERIC, 0)
      )
      RETURNING id INTO v_room_id;

      IF v_room_elem->'occupant_ids' IS NOT NULL AND jsonb_array_length(v_room_elem->'occupant_ids') > 0 THEN
        FOR v_occ_elem IN SELECT * FROM jsonb_array_elements(v_room_elem->'occupant_ids')
        LOOP
          INSERT INTO room_occupants (room_id, member_id)
          VALUES (v_room_id, (v_occ_elem #>> '{}')::UUID)
          ON CONFLICT (room_id, member_id) DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN v_hotel_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ATOMIC TRIP CREATION: create_trip_with_member
-- Guarantees atomic creation of trip and initial admin member without orphaned rows.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_trip_with_member(
  p_trip_code TEXT,
  p_name TEXT,
  p_password TEXT,
  p_creator_name TEXT,
  p_creator_mobile TEXT,
  p_creator_pin TEXT,
  p_avatar_color TEXT DEFAULT 'hsl(240, 78%, 58%)',
  p_upi_id TEXT DEFAULT NULL,
  p_upi_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_trip_id UUID;
  v_member_id UUID;
BEGIN
  INSERT INTO trips (trip_code, name, password, status)
  VALUES (UPPER(p_trip_code), p_name, p_password, 'active')
  RETURNING id INTO v_trip_id;

  INSERT INTO members (trip_id, name, mobile, pin, avatar_color, upi_id, upi_name)
  VALUES (v_trip_id, p_creator_name, p_creator_mobile, p_creator_pin, p_avatar_color, p_upi_id, p_upi_name)
  RETURNING id INTO v_member_id;

  UPDATE trips SET creator_id = v_member_id WHERE id = v_trip_id;

  RETURN jsonb_build_object(
    'trip_id', v_trip_id,
    'member_id', v_member_id
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execution to anon/authenticated roles
GRANT EXECUTE ON FUNCTION get_trip_bundle(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_expense_with_participants(UUID, TEXT, NUMERIC, UUID, expense_category, split_type, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_hotel_expense_with_rooms(UUID, TEXT, NUMERIC, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_trip_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- ANDROID APP (bill photos, UPI screenshots, atomic writes)
-- After this file, also run supabase/migrations/20260923_mobile_media.sql —
-- it adds the `attachments` table, the `trip-media` storage bucket + policies
-- and the idempotent tm_push_* functions. It is safe to run more than once.
-- ============================================================================

-- ============================================================================
-- DONE
-- All tables, indexes, views, RLS policies, RPC functions, and realtime subscriptions created.
-- ============================================================================

