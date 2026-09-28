CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

-- TripMate: lock trip data to trip members (safe to run more than once).
--
-- Before: the public (anon) API key could read and change every trip.
-- After: a request sees only the trips named in a short-lived "trip pass"
-- that the TripMate server signs after checking the login session, sent in
-- the x-tm-auth header. Without a valid pass, anon sees nothing.
--
-- Run this AFTER the new website is deployed (it sets the signing key on its
-- first request) and the new Android app is out. Old app versions stop
-- syncing once this has run.

-- 1. Signing key for trip passes. Only the server (service role) can set it.
CREATE TABLE IF NOT EXISTS public.tm_db_keys (
id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
key BYTEA NOT NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tm_db_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tm_db_keys FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tm_set_db_key(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
IF p_key IS NULL OR p_key !~ '^[0-9a-f]{64}$' THEN
RAISE EXCEPTION 'key must be 64 hex characters';
END IF;
INSERT INTO public.tm_db_keys (id, key, updated_at) VALUES (1, decode(p_key, 'hex'), now())
ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, updated_at = now()
WHERE public.tm_db_keys.key IS DISTINCT FROM EXCLUDED.key;
END;
$$;
REVOKE ALL ON FUNCTION public.tm_set_db_key(TEXT) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
GRANT EXECUTE ON FUNCTION public.tm_set_db_key(TEXT) TO service_role;
END IF;
END $$;

-- 2. The trips this request may touch, read from the signed pass:
--    v1.<expiry unix seconds>.<trip uuid>[,<trip uuid>...].<hex HMAC-SHA256>
--    Anything missing, malformed, forged or expired gives an empty list.
CREATE OR REPLACE FUNCTION public.tm_request_trips()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
h TEXT;
parts TEXT[];
k BYTEA;
BEGIN
BEGIN
h := current_setting('request.headers', true)::json->>'x-tm-auth';
EXCEPTION WHEN others THEN
RETURN '{}';
END;
IF h IS NULL OR length(h) > 8000 THEN RETURN '{}'; END IF;
parts := string_to_array(h, '.');
IF array_length(parts, 1) <> 4 OR parts[1] <> 'v1' OR parts[2] !~ '^[0-9]{1,12}$'
OR parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$'
OR parts[4] !~ '^[0-9a-f]{64}$' THEN
RETURN '{}';
END IF;
SELECT t.key INTO k FROM public.tm_db_keys t WHERE t.id = 1;
IF k IS NULL THEN RETURN '{}'; END IF;
IF encode(hmac(convert_to(parts[1] || '.' || parts[2] || '.' || parts[3], 'UTF8'), k, 'sha256'), 'hex') <> parts[4] THEN
RETURN '{}';
END IF;
IF parts[2]::BIGINT < extract(epoch FROM now()) THEN RETURN '{}'; END IF;
RETURN string_to_array(parts[3], ',')::UUID[];
END;
$$;
REVOKE ALL ON FUNCTION public.tm_request_trips() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_request_trips() TO anon, authenticated;

-- 3. Drop every earlier policy on trip tables (open to all trips).
DO $$
DECLARE
r RECORD;
BEGIN
FOR r IN
SELECT policyname, tablename FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (
'trips', 'members', 'expenses', 'expense_participants', 'hotel_expenses', 'rooms',
'room_occupants', 'settlement_groups', 'settlement_group_members', 'sponsorships',
'settlements', 'attachments')
LOOP
EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
END LOOP;
END $$;

-- 4. Table rights for the API roles: only what the apps use.
DO $$
DECLARE
t TEXT;
BEGIN
FOREACH t IN ARRAY ARRAY[
'trips', 'members', 'expenses', 'expense_participants', 'hotel_expenses', 'rooms',
'room_occupants', 'settlement_groups', 'settlement_group_members', 'sponsorships',
'settlements', 'attachments']
LOOP
IF to_regclass('public.' || t) IS NOT NULL THEN
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
IF t NOT IN ('trips', 'members') THEN
EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
END IF;
END IF;
END LOOP;
END $$;

-- Trips are created and joined only through the server. Members may close a
-- trip and restore its admin; nothing else about a trip row is editable.
GRANT SELECT ON public.trips TO anon, authenticated;
GRANT UPDATE (status, closed_at, creator_id) ON public.trips TO anon, authenticated;
-- Members can add placeholder members and edit UPI details, never a PIN.
ALTER TABLE public.members ALTER COLUMN pin SET DEFAULT '';
GRANT SELECT ON public.members TO anon, authenticated;
GRANT INSERT (id, trip_id, name, mobile, avatar_color, joined_at, upi_id, upi_name) ON public.members TO anon, authenticated;
GRANT UPDATE (name, upi_id, upi_name, avatar_color) ON public.members TO anon, authenticated;

-- 5. Trip-scoped policies. The IN (SELECT ...) subquery runs once per query.
CREATE POLICY tm_trips_select ON public.trips FOR SELECT TO anon, authenticated
USING (id IN (SELECT unnest(public.tm_request_trips())));
CREATE POLICY tm_trips_update ON public.trips FOR UPDATE TO anon, authenticated
USING (id IN (SELECT unnest(public.tm_request_trips())))
WITH CHECK (id IN (SELECT unnest(public.tm_request_trips())));

CREATE POLICY tm_members_select ON public.members FOR SELECT TO anon, authenticated
USING (trip_id IN (SELECT unnest(public.tm_request_trips())));
CREATE POLICY tm_members_insert ON public.members FOR INSERT TO anon, authenticated
WITH CHECK (trip_id IN (SELECT unnest(public.tm_request_trips())));
CREATE POLICY tm_members_update ON public.members FOR UPDATE TO anon, authenticated
USING (trip_id IN (SELECT unnest(public.tm_request_trips())))
WITH CHECK (trip_id IN (SELECT unnest(public.tm_request_trips())));

DO $$
DECLARE
t TEXT;
BEGIN
FOREACH t IN ARRAY ARRAY['expenses', 'hotel_expenses', 'rooms', 'settlement_groups', 'sponsorships', 'settlements', 'attachments']
LOOP
IF to_regclass('public.' || t) IS NOT NULL THEN
EXECUTE format(
'CREATE POLICY tm_%s_all ON public.%I FOR ALL TO anon, authenticated '
|| 'USING (trip_id IN (SELECT unnest(public.tm_request_trips()))) '
|| 'WITH CHECK (trip_id IN (SELECT unnest(public.tm_request_trips())))', t, t);
END IF;
END LOOP;
END $$;

CREATE POLICY tm_expense_participants_all ON public.expense_participants FOR ALL TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_participants.expense_id
AND e.trip_id IN (SELECT unnest(public.tm_request_trips()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_participants.expense_id
AND e.trip_id IN (SELECT unnest(public.tm_request_trips()))));

CREATE POLICY tm_room_occupants_all ON public.room_occupants FOR ALL TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_occupants.room_id
AND r.trip_id IN (SELECT unnest(public.tm_request_trips()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_occupants.room_id
AND r.trip_id IN (SELECT unnest(public.tm_request_trips()))));

CREATE POLICY tm_settlement_group_members_all ON public.settlement_group_members FOR ALL TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.settlement_groups g WHERE g.id = settlement_group_members.group_id
AND g.trip_id IN (SELECT unnest(public.tm_request_trips()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.settlement_groups g WHERE g.id = settlement_group_members.group_id
AND g.trip_id IN (SELECT unnest(public.tm_request_trips()))));

-- 6. Database functions that bypassed the rules, or are only for the server.
DO $$
DECLARE
f TEXT;
BEGIN
FOREACH f IN ARRAY ARRAY[
'public.get_trip_bundle(text)',
'public.create_trip_with_member(text,text,text,text,text,text,text,text,text)',
'public.create_expense_with_participants(uuid,text,numeric,uuid,expense_category,split_type,text,jsonb)',
'public.create_hotel_expense_with_rooms(uuid,text,numeric,uuid,jsonb)',
'public.tm_find_trips_by_mobile(text)',
'public.tm_verify_member_pin(uuid,text)',
'public.tm_media_path_ok(text)',
'public.tm_media_in_use(text)']
LOOP
IF to_regprocedure(f) IS NOT NULL THEN
EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
END IF;
END IF;
END LOOP;
END $$;

-- 7. Photos: the trip-media bucket becomes private. The server hands out
--    photos and accepts uploads only for the caller's own trips.
--    The android-app bucket stays downloadable, but only the owner's secret
--    key can replace the APK.
DO $$
DECLARE
p TEXT;
BEGIN
IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;
FOREACH p IN ARRAY ARRAY[
'tripmate_media_insert', 'tripmate_media_update', 'tripmate_media_select', 'tripmate_media_delete',
'tripmate_media_delete_orphans', 'allow_all_trip_media', 'allow_all_android_app',
'android_app_insert', 'android_app_update', 'android_app_delete']
LOOP
EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p);
END LOOP;
UPDATE storage.buckets SET public = false WHERE id = 'trip-media';
END $$;

NOTIFY pgrst, 'reload schema';
