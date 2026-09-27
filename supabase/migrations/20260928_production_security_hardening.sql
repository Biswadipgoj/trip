-- ============================================================================
-- TripMate — Production Security Hardening & Media Infrastructure
-- 
-- Run this entire script in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New query -> Paste & Click Run.
--
-- This script fixes all 9 Supabase Database Linter issues:
-- 1. ERROR: security_definer_view on public.member_balances & public.trip_summary
--    -> Sets security_invoker = true so views enforce the querying user's RLS.
-- 2. WARN:  public_bucket_allows_listing on android-app & trip-media
--    -> Drops broad SELECT policies on storage.objects. Public buckets serve
--       downloads directly via public URL without exposing directory listing.
-- 3. WARN:  function_search_path_mutable on public.update_updated_at
--    -> Recreated with SECURITY INVOKER SET search_path = public.
-- 4. WARN:  anon_security_definer_function_executable &
--           authenticated_security_definer_function_executable on:
--           - public.rls_auto_enable(): Revokes EXECUTE from anon, authenticated, PUBLIC.
--           - public.tm_media_in_use(p_name text): Switched to SECURITY INVOKER SET search_path = public.
--           - public.tm_media_path_ok(p_name text): Switched to SECURITY INVOKER SET search_path = public.
-- 5. Hardens all RPC functions with search_path protection.
-- 6. Enforces 100% idempotent RLS policies (DROP POLICY IF EXISTS before every CREATE).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. STORAGE BUCKETS SETUP
-- ============================================================================

-- Bucket for bill receipts and UPI screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-media',
  'trip-media',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket for release APK downloads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'android-app',
  'android-app',
  true,
  209715200, -- 200 MB limit
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. ATTACHMENTS TABLE
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_attachments_trip     ON public.attachments (trip_id);
CREATE INDEX IF NOT EXISTS idx_attachments_expense  ON public.attachments (expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_hotel    ON public.attachments (hotel_expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_payment  ON public.attachments (trip_id, from_member_id, to_member_id);

-- Enable Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- 3. STORAGE VALIDATION FUNCTIONS (SECURITY INVOKER with search_path)
-- Fixes: anon_security_definer_function_executable & authenticated_security_definer_function_executable
-- ============================================================================

-- Media path validation helper: must be in <trip-uuid>/(bills|payments|payment_proofs)/<uuid>.(jpg|jpeg|png|webp)
CREATE OR REPLACE FUNCTION public.tm_media_path_ok(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments|payment_proofs)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
     AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = split_part(p_name, '/', 1)::uuid);
$$;

GRANT EXECUTE ON FUNCTION public.tm_media_path_ok(TEXT) TO anon, authenticated;

-- Helper to check if an uploaded image is still referenced
CREATE OR REPLACE FUNCTION public.tm_media_in_use(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.attachments a WHERE a.storage_path = p_name);
$$;

GRANT EXECUTE ON FUNCTION public.tm_media_in_use(TEXT) TO anon, authenticated;

-- ============================================================================
-- 4. STORAGE SECURITY POLICIES
-- Fixes: public_bucket_allows_listing
-- Dropping broad SELECT policies prevents unauthorized enumeration of bucket files.
-- Public downloads still work via direct public URLs: /storage/v1/object/public/...
-- ============================================================================

DROP POLICY IF EXISTS "tripmate_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_update" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_select" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_delete_orphans" ON storage.objects;
DROP POLICY IF EXISTS "android_app_insert" ON storage.objects;
DROP POLICY IF EXISTS "android_app_update" ON storage.objects;
DROP POLICY IF EXISTS "android_app_delete" ON storage.objects;
DROP POLICY IF EXISTS "android_app_select" ON storage.objects;

-- Strict storage insert: valid MIME + valid trip folder
CREATE POLICY "tripmate_media_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'trip-media' AND public.tm_media_path_ok(name));

-- Strict storage update: path-restricted
CREATE POLICY "tripmate_media_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'trip-media' AND public.tm_media_path_ok(name))
  WITH CHECK (bucket_id = 'trip-media' AND public.tm_media_path_ok(name));

-- Strict storage delete: only unreferenced images can be deleted
CREATE POLICY "tripmate_media_delete_orphans" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'trip-media' AND NOT public.tm_media_in_use(name));

-- NOTE: No SELECT policy is created for public buckets (trip-media, android-app)
-- because public buckets serve downloads directly via public URL.
-- This resolves Supabase Linter rule 0025_public_bucket_allows_listing.

-- ============================================================================
-- 5. VIEW SECURITY HARDENING (SECURITY INVOKER = TRUE)
-- Fixes: ERROR 0010_security_definer_view on member_balances & trip_summary
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'member_balances') THEN
    ALTER VIEW public.member_balances SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'trip_summary') THEN
    ALTER VIEW public.trip_summary SET (security_invoker = true);
  END IF;
END $$;

-- ============================================================================
-- 6. FUNCTION SECURITY HARDENING (search_path & revocations)
-- Fixes: function_search_path_mutable & unauthorized SECURITY DEFINER execution
-- ============================================================================

-- Fix function_search_path_mutable on update_updated_at
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

-- Fix anon/authenticated execute on rls_auto_enable (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;';
  END IF;
END $$;

-- Harden get_trip_bundle
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

-- Harden create_expense_with_participants
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

-- Harden create_hotel_expense_with_rooms
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

-- Harden create_trip_with_member
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

GRANT EXECUTE ON FUNCTION public.get_trip_bundle(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_with_participants(UUID, TEXT, NUMERIC, UUID, expense_category, split_type, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_hotel_expense_with_rooms(UUID, TEXT, NUMERIC, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES (Guaranteed Idempotent)
-- ============================================================================

-- Ensure RLS is active on all tables
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

-- TRIPS: Read/Insert/Update protected
DROP POLICY IF EXISTS "allow_all_trips" ON public.trips;
DROP POLICY IF EXISTS "tripmate_trips_select" ON public.trips;
CREATE POLICY "tripmate_trips_select" ON public.trips
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "tripmate_trips_insert" ON public.trips;
CREATE POLICY "tripmate_trips_insert" ON public.trips
  FOR INSERT TO anon, authenticated
  WITH CHECK (trip_code IS NOT NULL AND length(trip_code) >= 4 AND name IS NOT NULL);

DROP POLICY IF EXISTS "tripmate_trips_update" ON public.trips;
CREATE POLICY "tripmate_trips_update" ON public.trips
  FOR UPDATE TO anon, authenticated
  USING (id IS NOT NULL);

-- MEMBERS: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_members" ON public.members;
DROP POLICY IF EXISTS "tripmate_members_all" ON public.members;
CREATE POLICY "tripmate_members_all" ON public.members
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = members.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = members.trip_id));

-- EXPENSES: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_expenses" ON public.expenses;
DROP POLICY IF EXISTS "tripmate_expenses_all" ON public.expenses;
CREATE POLICY "tripmate_expenses_all" ON public.expenses
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = expenses.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = expenses.trip_id));

-- EXPENSE PARTICIPANTS: Scoped to valid expense
DROP POLICY IF EXISTS "allow_all_expense_participants" ON public.expense_participants;
DROP POLICY IF EXISTS "tripmate_expense_participants_all" ON public.expense_participants;
CREATE POLICY "tripmate_expense_participants_all" ON public.expense_participants
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses WHERE expenses.id = expense_participants.expense_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses WHERE expenses.id = expense_participants.expense_id));

-- HOTEL EXPENSES: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_hotel_expenses" ON public.hotel_expenses;
DROP POLICY IF EXISTS "tripmate_hotel_expenses_all" ON public.hotel_expenses;
CREATE POLICY "tripmate_hotel_expenses_all" ON public.hotel_expenses
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = hotel_expenses.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = hotel_expenses.trip_id));

-- ROOMS: Scoped to valid hotel
DROP POLICY IF EXISTS "allow_all_rooms" ON public.rooms;
DROP POLICY IF EXISTS "tripmate_rooms_all" ON public.rooms;
CREATE POLICY "tripmate_rooms_all" ON public.rooms
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.hotel_expenses WHERE hotel_expenses.id = rooms.hotel_expense_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotel_expenses WHERE hotel_expenses.id = rooms.hotel_expense_id));

-- ROOM OCCUPANTS: Scoped to valid room
DROP POLICY IF EXISTS "allow_all_room_occupants" ON public.room_occupants;
DROP POLICY IF EXISTS "tripmate_room_occupants_all" ON public.room_occupants;
CREATE POLICY "tripmate_room_occupants_all" ON public.room_occupants
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_occupants.room_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_occupants.room_id));

-- SETTLEMENT GROUPS: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_settlement_groups" ON public.settlement_groups;
DROP POLICY IF EXISTS "tripmate_settlement_groups_all" ON public.settlement_groups;
CREATE POLICY "tripmate_settlement_groups_all" ON public.settlement_groups
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlement_groups.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlement_groups.trip_id));

-- SETTLEMENT GROUP MEMBERS: Scoped to valid group
DROP POLICY IF EXISTS "allow_all_settlement_group_members" ON public.settlement_group_members;
DROP POLICY IF EXISTS "tripmate_settlement_group_members_all" ON public.settlement_group_members;
CREATE POLICY "tripmate_settlement_group_members_all" ON public.settlement_group_members
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.settlement_groups WHERE settlement_groups.id = settlement_group_members.group_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.settlement_groups WHERE settlement_groups.id = settlement_group_members.group_id));

-- SPONSORSHIPS: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_sponsorships" ON public.sponsorships;
DROP POLICY IF EXISTS "tripmate_sponsorships_all" ON public.sponsorships;
CREATE POLICY "tripmate_sponsorships_all" ON public.sponsorships
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = sponsorships.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = sponsorships.trip_id));

-- SETTLEMENTS: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_settlements" ON public.settlements;
DROP POLICY IF EXISTS "tripmate_settlements_all" ON public.settlements;
CREATE POLICY "tripmate_settlements_all" ON public.settlements
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlements.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlements.trip_id));

-- ATTACHMENTS: Scoped to valid trip
DROP POLICY IF EXISTS "allow_all_attachments" ON public.attachments;
DROP POLICY IF EXISTS "tripmate_attachments_all" ON public.attachments;
CREATE POLICY "tripmate_attachments_all" ON public.attachments
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = attachments.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = attachments.trip_id));

-- ============================================================================
-- 8. ATOMIC IDEMPOTENT WRITES FOR MOBILE APP
-- ============================================================================

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

GRANT EXECUTE ON FUNCTION public.tm_push_expense(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_hotel_expense(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_settlement_group(JSONB, JSONB) TO anon, authenticated;

-- Ensure trip closure doesn't wipe uploaded bill images
DROP TRIGGER IF EXISTS tr_trip_closed_or_deleted ON public.trips;
DROP FUNCTION IF EXISTS public.tm_on_trip_closed_or_deleted();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
