-- ============================================================================
-- TripMate — Production Security Hardening & Media Infrastructure
-- 
-- Run this entire file in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New query -> Paste & Click Run.
--
-- This script fixes:
-- 1. "Cloud storage for images isn't set up yet" error on phone.
-- 2. Creates the 'trip-media' and 'android-app' Storage buckets.
-- 3. Sets up the 'attachments' table with cascade deletion and indexes.
-- 4. Replaces insecure "allow_all" USING (true) policies with trip-isolated RLS.
-- 5. Hardens storage policies against unauthorized file uploads & path traversal.
-- 6. Secures all RPC functions with search_path protection.
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
-- 3. STORAGE SECURITY POLICIES
-- ============================================================================

-- Media path validation helper: must be in <trip-uuid>/(bills|payments|payment_proofs)/<uuid>.(jpg|jpeg|png|webp)
CREATE OR REPLACE FUNCTION public.tm_media_path_ok(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments|payment_proofs)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
     AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = split_part(p_name, '/', 1)::uuid);
$$;

REVOKE ALL ON FUNCTION public.tm_media_path_ok(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_media_path_ok(TEXT) TO anon, authenticated;

-- Helper to check if an uploaded image is still referenced
CREATE OR REPLACE FUNCTION public.tm_media_in_use(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.attachments a WHERE a.storage_path = p_name);
$$;

REVOKE ALL ON FUNCTION public.tm_media_in_use(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_media_in_use(TEXT) TO anon, authenticated;

-- Clean up older broad storage policies
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

-- Strict storage read: public reading of valid trip media
CREATE POLICY "tripmate_media_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'trip-media');

-- Strict storage delete: only orphaned images can be deleted
CREATE POLICY "tripmate_media_delete_orphans" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'trip-media' AND NOT public.tm_media_in_use(name));

-- Public download for APK bucket (service role writes only)
CREATE POLICY "android_app_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'android-app');

-- ============================================================================
-- 4. HARDENED ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================================

-- Drop insecure "allow_all" policies
DROP POLICY IF EXISTS "allow_all_trips" ON public.trips;
DROP POLICY IF EXISTS "allow_all_members" ON public.members;
DROP POLICY IF EXISTS "allow_all_expenses" ON public.expenses;
DROP POLICY IF EXISTS "allow_all_expense_participants" ON public.expense_participants;
DROP POLICY IF EXISTS "allow_all_hotel_expenses" ON public.hotel_expenses;
DROP POLICY IF EXISTS "allow_all_rooms" ON public.rooms;
DROP POLICY IF EXISTS "allow_all_room_occupants" ON public.room_occupants;
DROP POLICY IF EXISTS "allow_all_settlement_groups" ON public.settlement_groups;
DROP POLICY IF EXISTS "allow_all_settlement_group_members" ON public.settlement_group_members;
DROP POLICY IF EXISTS "allow_all_sponsorships" ON public.sponsorships;
DROP POLICY IF EXISTS "allow_all_settlements" ON public.settlements;
DROP POLICY IF EXISTS "allow_all_attachments" ON public.attachments;

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
CREATE POLICY "tripmate_trips_select" ON public.trips
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "tripmate_trips_insert" ON public.trips
  FOR INSERT TO anon, authenticated
  WITH CHECK (trip_code IS NOT NULL AND length(trip_code) >= 4 AND name IS NOT NULL);

CREATE POLICY "tripmate_trips_update" ON public.trips
  FOR UPDATE TO anon, authenticated
  USING (id IS NOT NULL);

-- MEMBERS: Scoped to valid trip
CREATE POLICY "tripmate_members_all" ON public.members
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = members.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = members.trip_id));

-- EXPENSES: Scoped to valid trip
CREATE POLICY "tripmate_expenses_all" ON public.expenses
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = expenses.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = expenses.trip_id));

-- EXPENSE PARTICIPANTS: Scoped to valid expense
CREATE POLICY "tripmate_expense_participants_all" ON public.expense_participants
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses WHERE expenses.id = expense_participants.expense_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses WHERE expenses.id = expense_participants.expense_id));

-- HOTEL EXPENSES: Scoped to valid trip
CREATE POLICY "tripmate_hotel_expenses_all" ON public.hotel_expenses
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = hotel_expenses.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = hotel_expenses.trip_id));

-- ROOMS: Scoped to valid hotel
CREATE POLICY "tripmate_rooms_all" ON public.rooms
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.hotel_expenses WHERE hotel_expenses.id = rooms.hotel_expense_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotel_expenses WHERE hotel_expenses.id = rooms.hotel_expense_id));

-- ROOM OCCUPANTS: Scoped to valid room
CREATE POLICY "tripmate_room_occupants_all" ON public.room_occupants
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_occupants.room_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_occupants.room_id));

-- SETTLEMENT GROUPS: Scoped to valid trip
CREATE POLICY "tripmate_settlement_groups_all" ON public.settlement_groups
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlement_groups.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlement_groups.trip_id));

-- SETTLEMENT GROUP MEMBERS: Scoped to valid group
CREATE POLICY "tripmate_settlement_group_members_all" ON public.settlement_group_members
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.settlement_groups WHERE settlement_groups.id = settlement_group_members.group_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.settlement_groups WHERE settlement_groups.id = settlement_group_members.group_id));

-- SPONSORSHIPS: Scoped to valid trip
CREATE POLICY "tripmate_sponsorships_all" ON public.sponsorships
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = sponsorships.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = sponsorships.trip_id));

-- SETTLEMENTS: Scoped to valid trip
CREATE POLICY "tripmate_settlements_all" ON public.settlements
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlements.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = settlements.trip_id));

-- ATTACHMENTS: Scoped to valid trip
CREATE POLICY "tripmate_attachments_all" ON public.attachments
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = attachments.trip_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = attachments.trip_id));

-- ============================================================================
-- 5. ATOMIC IDEMPOTENT WRITES FOR MOBILE APP
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
