SET search_path = public, extensions;

-- EMERGENCY ONLY: undoes 20261002_lock_trip_data.sql and reopens every trip
-- to the public key, as before. Run 20260928_production_security_hardening.sql
-- right after this to restore its policies. Re-run the lock as soon as possible.

GRANT SELECT, INSERT, UPDATE, DELETE ON
public.trips, public.members, public.expenses, public.expense_participants, public.hotel_expenses,
public.rooms, public.room_occupants, public.settlement_groups, public.settlement_group_members,
public.sponsorships, public.settlements, public.attachments
TO anon, authenticated;

DO $$
DECLARE
r RECORD;
BEGIN
FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'tm\_%' ESCAPE '\'
LOOP
EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
END LOOP;
END $$;

DO $$
DECLARE
f TEXT;
BEGIN
FOREACH f IN ARRAY ARRAY['public.tm_find_trips_by_mobile(text)', 'public.tm_verify_member_pin(uuid,text)',
'public.tm_media_path_ok(text)', 'public.tm_media_in_use(text)', 'public.get_trip_bundle(text)']
LOOP
IF to_regprocedure(f) IS NOT NULL THEN
EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
END IF;
END LOOP;
END $$;

UPDATE storage.buckets SET public = true WHERE id = 'trip-media';
