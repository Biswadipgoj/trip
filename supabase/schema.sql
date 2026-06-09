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
      SUM(r.cost::NUMERIC / occ.cnt) AS total_owed
    FROM room_occupants ro
    JOIN rooms r ON r.id = ro.room_id
    JOIN hotel_expenses h ON h.id = r.hotel_expense_id
    JOIN (
      SELECT room_id, COUNT(*) AS cnt FROM room_occupants GROUP BY room_id
    ) occ ON occ.room_id = ro.room_id
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
-- High-level stats per trip
-- ============================================================================

CREATE OR REPLACE VIEW trip_summary AS
SELECT
  t.id                                                  AS trip_id,
  t.name                                                AS trip_name,
  t.trip_code,
  t.status,
  t.created_at,
  t.closed_at,
  COUNT(DISTINCT m.id)                                  AS member_count,
  COUNT(DISTINCT e.id)                                  AS expense_count,
  COALESCE(SUM(DISTINCT e.amount), 0)                   AS total_expense_amount,
  COALESCE(SUM(DISTINCT he.total_amount), 0)            AS total_hotel_amount,
  COALESCE(SUM(DISTINCT e.amount), 0)
    + COALESCE(SUM(DISTINCT he.total_amount), 0)        AS grand_total,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'confirmed') AS confirmed_settlements,
  COUNT(DISTINCT s.id)                                  AS total_settlements
FROM trips t
LEFT JOIN members       m  ON m.trip_id  = t.id
LEFT JOIN expenses      e  ON e.trip_id  = t.id
LEFT JOIN hotel_expenses he ON he.trip_id = t.id
LEFT JOIN settlements   s  ON s.trip_id  = t.id
GROUP BY t.id;

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
-- DONE
-- All tables, indexes, views, RLS policies, and realtime subscriptions created.
-- ============================================================================
