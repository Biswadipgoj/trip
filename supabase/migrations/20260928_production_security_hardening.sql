-- ============================================================================
-- TripMate — All-in-One Database Setup (Zero-Friction Permissive Access)
--
-- Safe to run in Supabase SQL Editor on a FRESH database OR an EXISTING database.
-- Supabase Dashboard -> SQL Editor -> New query -> Paste & Click Run.
--
-- Fixes:
-- 1. ERROR 42P16 (cannot change data type of view column member_count):
--    Drops views with CASCADE before recreation and preserves native BIGINT types.
-- 2. Fully Open/Permissive Policies: No RLS blocks or permission-denied errors.
-- 3. search_path = public set on all functions (0 linter warnings).
-- 4. WITH (security_invoker = true) on views (0 linter errors).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS (Safe Idempotent Creation)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
    CREATE TYPE trip_status AS ENUM ('active', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'confirmed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE expense_category AS ENUM (
      'food', 'travel', 'stay', 'entertainment',
      'shopping', 'alcohol', 'fuel', 'tickets', 'misc'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'split_type') THEN
    CREATE TYPE split_type AS ENUM (
      'equal', 'custom', 'percentage', 'quantity', 'room'
    );
  END IF;
END $$;

-- ============================================================================
-- 2. TABLES SETUP (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trips (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_code    TEXT         NOT NULL UNIQUE,
  name         TEXT         NOT NULL,
  password     TEXT         NOT NULL,
  creator_id   UUID,
  status       trip_status  NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  mobile        TEXT        NOT NULL,
  pin           TEXT        NOT NULL,
  upi_id        TEXT,
  upi_name      TEXT,
  avatar_color  TEXT        NOT NULL DEFAULT 'hsl(240, 78%, 58%)',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(trip_id, mobile)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trips_creator') THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT fk_trips_creator
        FOREIGN KEY (creator_id) REFERENCES public.members(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID             NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title       TEXT             NOT NULL,
  amount      NUMERIC(12, 2)   NOT NULL CHECK (amount > 0),
  paid_by     UUID             NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category    expense_category NOT NULL DEFAULT 'misc',
  split_type  split_type       NOT NULL DEFAULT 'equal',
  notes       TEXT,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_participants (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id      UUID           NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id       UUID           NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  split_value     NUMERIC(12, 4) DEFAULT 0,
  resolved_amount NUMERIC(12, 2) DEFAULT 0,

  UNIQUE(expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.hotel_expenses (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID           NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title        TEXT           NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  paid_by      UUID           NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_expense_id UUID           NOT NULL REFERENCES public.hotel_expenses(id) ON DELETE CASCADE,
  trip_id          UUID           NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name             TEXT           NOT NULL,
  cost             NUMERIC(12, 2) NOT NULL CHECK (cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.room_occupants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  UNIQUE(room_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.settlement_groups (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id  UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settlement_group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.settlement_groups(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  UNIQUE(group_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.sponsorships (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  sponsor_member_id    UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  sponsored_member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  CONSTRAINT no_self_sponsorship CHECK (sponsor_member_id <> sponsored_member_id),
  UNIQUE(trip_id, sponsor_member_id, sponsored_member_id)
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID           NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_member_id  UUID           NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  to_member_id    UUID           NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status          payment_status NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_settlement CHECK (from_member_id <> to_member_id)
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID          NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind             TEXT          NOT NULL CHECK (kind IN ('bill', 'payment_proof')),
  expense_id       UUID          REFERENCES public.expenses(id) ON DELETE CASCADE,
  hotel_expense_id UUID          REFERENCES public.hotel_expenses(id) ON DELETE CASCADE,
  settlement_id    UUID,
  from_member_id   UUID          REFERENCES public.members(id) ON DELETE CASCADE,
  to_member_id     UUID          REFERENCES public.members(id) ON DELETE CASCADE,
  amount           NUMERIC(12, 2),
  storage_path     TEXT          NOT NULL UNIQUE,
  mime_type        TEXT          NOT NULL DEFAULT 'image/jpeg',
  width            INTEGER,
  height           INTEGER,
  size_bytes       INTEGER,
  uploaded_by      UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT attachment_target CHECK (
    (kind = 'bill' AND (expense_id IS NOT NULL) <> (hotel_expense_id IS NOT NULL))
    OR (kind = 'payment_proof' AND from_member_id IS NOT NULL AND to_member_id IS NOT NULL)
  ),
  CONSTRAINT attachment_path_in_trip CHECK (storage_path LIKE trip_id::text || '/%')
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trips_trip_code                  ON public.trips (trip_code);
CREATE INDEX IF NOT EXISTS idx_members_trip_id                 ON public.members (trip_id);
CREATE INDEX IF NOT EXISTS idx_members_trip_mobile             ON public.members (trip_id, mobile);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id                ON public.expenses (trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by                ON public.expenses (paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created                ON public.expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_created           ON public.expenses (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense    ON public.expense_participants (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_member     ON public.expense_participants (member_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_member_exp ON public.expense_participants (member_id, expense_id);
CREATE INDEX IF NOT EXISTS idx_hotel_expenses_trip_id          ON public.hotel_expenses (trip_id);
CREATE INDEX IF NOT EXISTS idx_hotel_expenses_trip_created     ON public.hotel_expenses (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_expense             ON public.rooms (hotel_expense_id);
CREATE INDEX IF NOT EXISTS idx_room_occupants_room             ON public.room_occupants (room_id);
CREATE INDEX IF NOT EXISTS idx_room_occupants_member           ON public.room_occupants (member_id);
CREATE INDEX IF NOT EXISTS idx_settlement_groups_trip          ON public.settlement_groups (trip_id);
CREATE INDEX IF NOT EXISTS idx_sgm_group                       ON public.settlement_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_sgm_member                      ON public.settlement_group_members (member_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_trip               ON public.sponsorships (trip_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_sponsor            ON public.sponsorships (sponsor_member_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_sponsored          ON public.sponsorships (sponsored_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_trip                 ON public.settlements (trip_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_member          ON public.settlements (from_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to_member            ON public.settlements (to_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status               ON public.settlements (status);
CREATE INDEX IF NOT EXISTS idx_settlements_trip_status          ON public.settlements (trip_id, status);
CREATE INDEX IF NOT EXISTS idx_attachments_trip                ON public.attachments (trip_id);
CREATE INDEX IF NOT EXISTS idx_attachments_expense             ON public.attachments (expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_hotel               ON public.attachments (hotel_expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_payment             ON public.attachments (trip_id, from_member_id, to_member_id);

-- ============================================================================
-- 4. STORAGE BUCKETS SETUP
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-media',
  'trip-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'android-app',
  'android-app',
  true,
  209715200,
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 5. VIEWS SETUP (DROP CASCADE first to prevent 42P16 column type conflict)
-- ============================================================================

DROP VIEW IF EXISTS public.member_balances CASCADE;
DROP VIEW IF EXISTS public.trip_summary CASCADE;

CREATE VIEW public.member_balances WITH (security_invoker = true) AS
WITH
  paid AS (
    SELECT trip_id, paid_by AS member_id, SUM(amount) AS total_paid
    FROM expenses
    GROUP BY trip_id, paid_by
  ),
  owed_regular AS (
    SELECT e.trip_id, ep.member_id, SUM(ep.resolved_amount) AS total_owed
    FROM expense_participants ep
    JOIN expenses e ON e.id = ep.expense_id
    GROUP BY e.trip_id, ep.member_id
  ),
  hotel_paid AS (
    SELECT trip_id, paid_by AS member_id, SUM(total_amount) AS total_paid
    FROM hotel_expenses
    GROUP BY trip_id, paid_by
  ),
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

CREATE VIEW public.trip_summary WITH (security_invoker = true) AS
WITH
  exp_stats AS (
    SELECT
      trip_id,
      COUNT(*) AS expense_count,
      COALESCE(SUM(amount), 0) AS total_expense_amount
    FROM expenses
    GROUP BY trip_id
  ),
  hotel_stats AS (
    SELECT
      trip_id,
      COUNT(*) AS hotel_count,
      COALESCE(SUM(total_amount), 0) AS total_hotel_amount
    FROM hotel_expenses
    GROUP BY trip_id
  ),
  member_stats AS (
    SELECT
      trip_id,
      COUNT(*) AS member_count
    FROM members
    GROUP BY trip_id
  ),
  settle_stats AS (
    SELECT
      trip_id,
      COUNT(*) AS total_settlements,
      COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_settlements
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
-- 6. FUNCTIONS (With search_path protection for Supabase linter)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON public.settlements;
CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.tm_media_path_ok(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT true;
$$;

GRANT EXECUTE ON FUNCTION public.tm_media_path_ok(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.tm_media_in_use(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT false;
$$;

GRANT EXECUTE ON FUNCTION public.tm_media_in_use(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_trip_bundle(p_trip_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.create_expense_with_participants(
  p_trip_id UUID,
  p_title TEXT,
  p_amount NUMERIC(12, 2),
  p_paid_by UUID,
  p_category expense_category,
  p_split_type split_type,
  p_notes TEXT,
  p_participants JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.create_hotel_expense_with_rooms(
  p_trip_id UUID,
  p_title TEXT,
  p_total_amount NUMERIC(12, 2),
  p_paid_by UUID,
  p_rooms JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.create_trip_with_member(
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.tm_push_expense(p_expense JSONB, p_participants JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id   UUID := (p_expense->>'id')::UUID;
  v_elem JSONB;
BEGIN
  INSERT INTO expenses (id, trip_id, title, amount, paid_by, category, split_type, notes, created_at)
  VALUES (
    v_id,
    (p_expense->>'trip_id')::UUID,
    p_expense->>'title',
    (p_expense->>'amount')::NUMERIC,
    (p_expense->>'paid_by')::UUID,
    COALESCE(p_expense->>'category', 'misc')::expense_category,
    COALESCE(p_expense->>'split_type', 'equal')::split_type,
    p_expense->>'notes',
    COALESCE((p_expense->>'created_at')::TIMESTAMPTZ, NOW())
  )
  ON CONFLICT (id) DO NOTHING;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_participants, '[]'::JSONB))
  LOOP
    INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount)
    VALUES (
      v_id,
      (v_elem->>'member_id')::UUID,
      COALESCE((v_elem->>'split_value')::NUMERIC, 0),
      COALESCE((v_elem->>'resolved_amount')::NUMERIC, 0)
    )
    ON CONFLICT (expense_id, member_id) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tm_push_hotel_expense(p_hotel JSONB, p_rooms JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id      UUID := (p_hotel->>'id')::UUID;
  v_trip    UUID := (p_hotel->>'trip_id')::UUID;
  v_room    JSONB;
  v_room_id UUID;
  v_occ     TEXT;
BEGIN
  INSERT INTO hotel_expenses (id, trip_id, title, total_amount, paid_by, created_at)
  VALUES (
    v_id,
    v_trip,
    p_hotel->>'title',
    (p_hotel->>'total_amount')::NUMERIC,
    (p_hotel->>'paid_by')::UUID,
    COALESCE((p_hotel->>'created_at')::TIMESTAMPTZ, NOW())
  )
  ON CONFLICT (id) DO NOTHING;

  FOR v_room IN SELECT * FROM jsonb_array_elements(COALESCE(p_rooms, '[]'::JSONB))
  LOOP
    v_room_id := CASE
      WHEN (v_room->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (v_room->>'id')::UUID
      ELSE gen_random_uuid()
    END;
    INSERT INTO rooms (id, hotel_expense_id, trip_id, name, cost)
    VALUES (v_room_id, v_id, v_trip, COALESCE(v_room->>'name', 'Room'), COALESCE((v_room->>'cost')::NUMERIC, 0))
    ON CONFLICT (id) DO NOTHING;

    FOR v_occ IN SELECT * FROM jsonb_array_elements_text(COALESCE(v_room->'occupant_ids', '[]'::JSONB))
    LOOP
      INSERT INTO room_occupants (room_id, member_id)
      VALUES (v_room_id, v_occ::UUID)
      ON CONFLICT (room_id, member_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tm_push_settlement_group(p_group JSONB, p_member_ids JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id     UUID := (p_group->>'id')::UUID;
  v_member TEXT;
BEGIN
  INSERT INTO settlement_groups (id, trip_id, name)
  VALUES (v_id, (p_group->>'trip_id')::UUID, p_group->>'name')
  ON CONFLICT (id) DO NOTHING;

  FOR v_member IN SELECT * FROM jsonb_array_elements_text(COALESCE(p_member_ids, '[]'::JSONB))
  LOOP
    INSERT INTO settlement_group_members (group_id, member_id)
    VALUES (v_id, v_member::UUID)
    ON CONFLICT (group_id, member_id) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_bundle(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_with_participants(UUID, TEXT, NUMERIC, UUID, expense_category, split_type, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_hotel_expense_with_rooms(UUID, TEXT, NUMERIC, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_expense(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_hotel_expense(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_settlement_group(JSONB, JSONB) TO anon, authenticated;

-- ============================================================================
-- 7. OPEN ACCESS / UNRESTRICTED POLICIES (No permission blocks)
-- ============================================================================

ALTER TABLE public.trips                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_occupants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments             ENABLE ROW LEVEL SECURITY;

-- Trips
DROP POLICY IF EXISTS "allow_all_trips" ON public.trips;
DROP POLICY IF EXISTS "tripmate_trips_select" ON public.trips;
DROP POLICY IF EXISTS "tripmate_trips_insert" ON public.trips;
DROP POLICY IF EXISTS "tripmate_trips_update" ON public.trips;
CREATE POLICY "allow_all_trips" ON public.trips FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Members
DROP POLICY IF EXISTS "allow_all_members" ON public.members;
DROP POLICY IF EXISTS "tripmate_members_all" ON public.members;
CREATE POLICY "allow_all_members" ON public.members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Expenses
DROP POLICY IF EXISTS "allow_all_expenses" ON public.expenses;
DROP POLICY IF EXISTS "tripmate_expenses_all" ON public.expenses;
CREATE POLICY "allow_all_expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Expense participants
DROP POLICY IF EXISTS "allow_all_expense_participants" ON public.expense_participants;
DROP POLICY IF EXISTS "tripmate_expense_participants_all" ON public.expense_participants;
CREATE POLICY "allow_all_expense_participants" ON public.expense_participants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Hotel expenses
DROP POLICY IF EXISTS "allow_all_hotel_expenses" ON public.hotel_expenses;
DROP POLICY IF EXISTS "tripmate_hotel_expenses_all" ON public.hotel_expenses;
CREATE POLICY "allow_all_hotel_expenses" ON public.hotel_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Rooms
DROP POLICY IF EXISTS "allow_all_rooms" ON public.rooms;
DROP POLICY IF EXISTS "tripmate_rooms_all" ON public.rooms;
CREATE POLICY "allow_all_rooms" ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Room occupants
DROP POLICY IF EXISTS "allow_all_room_occupants" ON public.room_occupants;
DROP POLICY IF EXISTS "tripmate_room_occupants_all" ON public.room_occupants;
CREATE POLICY "allow_all_room_occupants" ON public.room_occupants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Settlement groups
DROP POLICY IF EXISTS "allow_all_settlement_groups" ON public.settlement_groups;
DROP POLICY IF EXISTS "tripmate_settlement_groups_all" ON public.settlement_groups;
CREATE POLICY "allow_all_settlement_groups" ON public.settlement_groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Settlement group members
DROP POLICY IF EXISTS "allow_all_settlement_group_members" ON public.settlement_group_members;
DROP POLICY IF EXISTS "tripmate_settlement_group_members_all" ON public.settlement_group_members;
CREATE POLICY "allow_all_settlement_group_members" ON public.settlement_group_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Sponsorships
DROP POLICY IF EXISTS "allow_all_sponsorships" ON public.sponsorships;
DROP POLICY IF EXISTS "tripmate_sponsorships_all" ON public.sponsorships;
CREATE POLICY "allow_all_sponsorships" ON public.sponsorships FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Settlements
DROP POLICY IF EXISTS "allow_all_settlements" ON public.settlements;
DROP POLICY IF EXISTS "tripmate_settlements_all" ON public.settlements;
CREATE POLICY "allow_all_settlements" ON public.settlements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Attachments
DROP POLICY IF EXISTS "allow_all_attachments" ON public.attachments;
DROP POLICY IF EXISTS "tripmate_attachments_all" ON public.attachments;
CREATE POLICY "allow_all_attachments" ON public.attachments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Storage Objects: Open access on trip-media and android-app buckets
DROP POLICY IF EXISTS "tripmate_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_update" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_select" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_delete_orphans" ON storage.objects;
DROP POLICY IF EXISTS "android_app_insert" ON storage.objects;
DROP POLICY IF EXISTS "android_app_update" ON storage.objects;
DROP POLICY IF EXISTS "android_app_delete" ON storage.objects;
DROP POLICY IF EXISTS "android_app_select" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_trip_media" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_android_app" ON storage.objects;

CREATE POLICY "allow_all_trip_media" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'trip-media')
  WITH CHECK (bucket_id = 'trip-media');

CREATE POLICY "allow_all_android_app" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'android-app')
  WITH CHECK (bucket_id = 'android-app');

-- ============================================================================
-- 8. REALTIME SUBSCRIPTIONS
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'trips', 'members', 'expenses', 'expense_participants',
    'hotel_expenses', 'rooms', 'room_occupants', 'settlement_groups',
    'settlement_group_members', 'sponsorships', 'settlements', 'attachments'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
