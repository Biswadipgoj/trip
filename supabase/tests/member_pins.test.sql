-- Test for supabase/migrations/20260929_protect_member_pins.sql, run as anon:
--   bash supabase/tests/run-member-pin-test.sh
-- Every check prints PASS; the script stops with FAIL on the first failure.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.check(label TEXT, ok BOOLEAN) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF ok THEN RAISE NOTICE 'PASS  %', label; ELSE RAISE EXCEPTION 'FAIL  %', label; END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.raises(sql TEXT, pattern TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM ~ pattern;
END $$;

SET ROLE anon;

SELECT pg_temp.check('T1 no plain-text PIN is readable from members',
  NOT EXISTS (SELECT 1 FROM members WHERE pin <> ''));

SELECT pg_temp.check('T2 member_pins cannot be read',
  pg_temp.raises('SELECT * FROM member_pins', 'permission denied'));

SELECT pg_temp.check('T3 member_pins cannot be written',
  pg_temp.raises($$UPDATE member_pins SET pin_hash = 'x'$$, 'permission denied'));

SELECT pg_temp.check('T4 migrated PIN verifies',
  tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000001', '1234'));

SELECT pg_temp.check('T5 wrong PIN is rejected',
  NOT tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000002', '9999'));

-- New member with a PIN, as the web and Android apps insert it.
INSERT INTO members (id, trip_id, name, mobile, pin)
VALUES ('aaaaaaaa-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Neha', '9000000005', '4321');

SELECT pg_temp.check('T6 PIN on a new member is blanked in the row',
  (SELECT pin FROM members WHERE id = 'aaaaaaaa-0000-4000-8000-000000000005') = '');

SELECT pg_temp.check('T7 PIN on a new member verifies',
  tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000005', '4321'));

-- Takeover attempt: write a new PIN into someone else's row.
UPDATE members SET pin = '0000' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';

SELECT pg_temp.check('T8 an UPDATE cannot replace an existing PIN',
  NOT tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000001', '0000')
  AND tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000001', '1234'));

SELECT pg_temp.check('T9 the takeover PIN was blanked too',
  (SELECT pin FROM members WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001') = '');

-- Brute force: 5 wrong PINs lock the member, even for the right PIN.
DO $$ BEGIN PERFORM tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000003', '0000') FROM generate_series(1, 5); END $$;
SELECT pg_temp.check('T10 after 5 wrong PINs the member is locked',
  pg_temp.raises($$SELECT tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000003', '5678')$$, 'PIN_LOCKED'));

SELECT pg_temp.check('T11 trips for a mobile: both trips, live first, with member counts',
  (SELECT array_agg(trip_code || ':' || status || ':' || member_count ORDER BY ord)
     FROM (SELECT *, row_number() OVER () AS ord FROM tm_find_trips_by_mobile('9876543210')) x)
  = ARRAY['TRP-GOA1:active:3', 'TRP-MNL1:closed:2']);

SELECT pg_temp.check('T12 members without a PIN are not offered for login',
  NOT EXISTS (SELECT 1 FROM tm_find_trips_by_mobile('manual-aaaaaaaa')));

SELECT pg_temp.check('T13 the lookup returns no PIN data',
  NOT EXISTS (
    SELECT 1 FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_name = 'tm_find_trips_by_mobile' AND p.parameter_name ILIKE '%pin%'));

-- create_trip_with_member (SECURITY INVOKER) still works for anon and captures the PIN.
SELECT pg_temp.check('T14 creating a trip via RPC still works and its PIN verifies',
  tm_verify_member_pin(
    (create_trip_with_member('TRP-NEW1', 'New', 'pw', 'Kiran', '9000000009', '2468') ->> 'member_id')::UUID,
    '2468'));

SELECT pg_temp.check('T15 unknown member returns false',
  NOT tm_verify_member_pin('00000000-0000-4000-8000-000000000000', '1234'));

DELETE FROM members WHERE id = 'aaaaaaaa-0000-4000-8000-000000000005';
RESET ROLE;
SELECT pg_temp.check('T16 deleting a member deletes its PIN hash',
  NOT EXISTS (SELECT 1 FROM member_pins WHERE member_id = 'aaaaaaaa-0000-4000-8000-000000000005'));
