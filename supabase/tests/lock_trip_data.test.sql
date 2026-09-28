-- Test for supabase/migrations/20261002_lock_trip_data.sql, run as anon:
--   bash supabase/tests/run-lock-test.sh
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

-- Rows changed by a statement (0 when RLS hides every target row).
CREATE OR REPLACE FUNCTION pg_temp.affected(sql TEXT) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  EXECUTE sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- A trip pass exactly as the server signs it, with the test key (hex 'ab' x 32).
CREATE OR REPLACE FUNCTION pg_temp.pass(trips TEXT, expires BIGINT, key_hex TEXT DEFAULT repeat('ab', 32)) RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'v1.' || expires || '.' || trips || '.'
    || encode(hmac(convert_to('v1.' || expires || '.' || trips, 'UTF8'), decode(key_hex, 'hex'), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION pg_temp.use(pass TEXT) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.headers', CASE WHEN pass IS NULL THEN '{}' ELSE json_build_object('x-tm-auth', pass)::text END, false)
$$;

CREATE OR REPLACE FUNCTION pg_temp.later() RETURNS BIGINT LANGUAGE sql AS $$
  SELECT extract(epoch FROM now())::BIGINT + 900
$$;

\set GOA '11111111-1111-4111-8111-111111111111'
\set MNL '22222222-2222-4222-8222-222222222222'

SET ROLE anon;

-- ── No pass: the public key sees nothing ─────────────────────────────────────
SELECT pg_temp.use(NULL);
SELECT pg_temp.check('L1 without a pass, no trips are visible', (SELECT count(*) FROM trips) = 0);
SELECT pg_temp.check('L2 without a pass, no members (names, mobiles, UPI IDs) are visible', (SELECT count(*) FROM members) = 0);
SELECT pg_temp.check('L3 without a pass, no expenses or splits are visible',
  (SELECT count(*) FROM expenses) = 0 AND (SELECT count(*) FROM expense_participants) = 0);
SELECT pg_temp.check('L4 without a pass, no settlements, groups or attachments are visible',
  (SELECT count(*) FROM settlements) + (SELECT count(*) FROM settlement_groups) + (SELECT count(*) FROM attachments) = 0);
SELECT pg_temp.check('L5 without a pass, the balance views are empty',
  (SELECT count(*) FROM member_balances) = 0 AND (SELECT count(*) FROM trip_summary) = 0);
SELECT pg_temp.check('L6 without a pass, nothing can be changed',
  pg_temp.affected($$UPDATE expenses SET amount = 1$$) = 0
  AND pg_temp.affected($$DELETE FROM settlements$$) = 0);

-- ── Server-only functions and data ───────────────────────────────────────────
SELECT pg_temp.check('L7 PIN check is server-only',
  pg_temp.raises($$SELECT tm_verify_member_pin('aaaaaaaa-0000-4000-8000-000000000001', '1234')$$, 'permission denied'));
SELECT pg_temp.check('L8 mobile-number trip lookup is server-only',
  pg_temp.raises($$SELECT * FROM tm_find_trips_by_mobile('9876543210')$$, 'permission denied'));
SELECT pg_temp.check('L9 old bundle function by trip code is closed',
  pg_temp.raises($$SELECT get_trip_bundle('TRP-GOA1')$$, 'permission denied'));
SELECT pg_temp.check('L10 the pass signing key cannot be read',
  pg_temp.raises($$SELECT * FROM tm_db_keys$$, 'permission denied'));
SELECT pg_temp.check('L11 the pass signing key cannot be replaced',
  pg_temp.raises($$SELECT tm_set_db_key(repeat('cd', 32))$$, 'permission denied'));
SELECT pg_temp.check('L12 trips cannot be created with the public key',
  pg_temp.raises($$INSERT INTO trips (trip_code, name, password) VALUES ('TRP-EVIL', 'x', 'x')$$, 'permission denied'));

-- ── Bad passes are ignored ───────────────────────────────────────────────────
SELECT pg_temp.use(pg_temp.pass(:'GOA', pg_temp.later(), repeat('cd', 32)));
SELECT pg_temp.check('L13 a pass signed with another key sees nothing', (SELECT count(*) FROM trips) = 0);

SELECT pg_temp.use(pg_temp.pass(:'GOA', extract(epoch FROM now())::BIGINT - 1));
SELECT pg_temp.check('L14 an expired pass sees nothing', (SELECT count(*) FROM trips) = 0);

SELECT pg_temp.use(replace(pg_temp.pass(:'GOA', pg_temp.later()), :'GOA', :'GOA' || ',' || :'MNL'));
SELECT pg_temp.check('L15 adding a trip to a signed pass breaks it', (SELECT count(*) FROM trips) = 0);

SELECT pg_temp.use('v1.99999999999.' || :'GOA' || '.' || repeat('0', 64));
SELECT pg_temp.check('L16 a made-up signature sees nothing', (SELECT count(*) FROM trips) = 0);

SELECT pg_temp.use('garbage');
SELECT pg_temp.check('L17 a malformed pass sees nothing (no error)', (SELECT count(*) FROM trips) = 0);

-- ── A valid pass for Goa reaches Goa only ────────────────────────────────────
SELECT pg_temp.use(pg_temp.pass(:'GOA', pg_temp.later()));
SELECT pg_temp.check('L18 a Goa pass sees exactly the Goa trip',
  (SELECT array_agg(trip_code) FROM trips) = ARRAY['TRP-GOA1']);
SELECT pg_temp.check('L19 a Goa pass sees only Goa members',
  (SELECT count(*) FROM members) = 2 AND NOT EXISTS (SELECT 1 FROM members WHERE trip_id <> :'GOA'));
SELECT pg_temp.check('L20 a Goa pass sees only Goa expenses and splits',
  (SELECT count(*) FROM expenses) = 1 AND (SELECT count(*) FROM expense_participants) = 1);
SELECT pg_temp.check('L21 Manali settlements cannot be changed or deleted from Goa',
  pg_temp.affected($$UPDATE settlements SET status = 'confirmed' WHERE trip_id = '22222222-2222-4222-8222-222222222222'$$) = 0
  AND pg_temp.affected($$DELETE FROM settlements WHERE trip_id = '22222222-2222-4222-8222-222222222222'$$) = 0);
SELECT pg_temp.check('L22 an expense cannot be added to Manali from Goa',
  pg_temp.raises($$INSERT INTO expenses (trip_id, title, amount, paid_by) VALUES
    ('22222222-2222-4222-8222-222222222222', 'x', 1, 'bbbbbbbb-0000-4000-8000-000000000001')$$, 'row-level security'));
SELECT pg_temp.check('L23 a split cannot be attached to a Manali expense',
  pg_temp.raises($$INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount) VALUES
    ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1)$$, 'row-level security'));
SELECT pg_temp.check('L24 a member cannot be added to a Manali couple group',
  pg_temp.raises($$INSERT INTO settlement_group_members (group_id, member_id) VALUES
    ('99999999-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')$$, 'row-level security'));
SELECT pg_temp.check('L25 the atomic push function obeys the same rule',
  pg_temp.raises($$SELECT tm_push_expense(
    '{"id":"eeeeeeee-0000-4000-8000-000000000009","trip_id":"22222222-2222-4222-8222-222222222222","title":"x","amount":1,"paid_by":"bbbbbbbb-0000-4000-8000-000000000001"}'::jsonb,
    '[]'::jsonb)$$, 'row-level security'));
SELECT pg_temp.check('L26 a member cannot be moved to Manali',
  pg_temp.raises($$UPDATE members SET trip_id = '22222222-2222-4222-8222-222222222222'
    WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002'$$, 'permission denied'));

-- What the apps do every day still works inside the trip.
INSERT INTO expenses (id, trip_id, title, amount, paid_by) VALUES
  ('eeeeeeee-0000-4000-8000-000000000003', :'GOA', 'Scooters', 600, 'aaaaaaaa-0000-4000-8000-000000000002');
INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount) VALUES
  ('eeeeeeee-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 300);
SELECT tm_push_expense(
  '{"id":"eeeeeeee-0000-4000-8000-000000000004","trip_id":"11111111-1111-4111-8111-111111111111","title":"Chai","amount":80,"paid_by":"aaaaaaaa-0000-4000-8000-000000000001"}'::jsonb,
  '[{"member_id":"aaaaaaaa-0000-4000-8000-000000000002","split_value":1,"resolved_amount":40}]'::jsonb);
INSERT INTO members (id, trip_id, name, mobile, avatar_color) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', :'GOA', 'Kabir', 'manual-aaaaaaaa', '#3b82f6');
UPDATE members SET upi_id = 'ravi@upi' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002';
UPDATE trips SET status = 'closed', closed_at = now() WHERE id = :'GOA';
SELECT pg_temp.check('L27 members add expenses, splits, placeholders, UPI IDs and close the trip',
  (SELECT count(*) FROM expenses) = 3 AND (SELECT count(*) FROM expense_participants) = 3
  AND (SELECT upi_id FROM members WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002') = 'ravi@upi'
  AND (SELECT status FROM trips) = 'closed');
SELECT pg_temp.check('L28 a PIN cannot be set or changed through the public key',
  pg_temp.raises($$INSERT INTO members (trip_id, name, mobile, pin) VALUES ('11111111-1111-4111-8111-111111111111', 'x', '9000000009', '0000')$$, 'permission denied')
  AND pg_temp.raises($$UPDATE members SET pin = '0000' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003'$$, 'permission denied'));
SELECT pg_temp.check('L29 the trip password cannot be changed',
  pg_temp.raises($$UPDATE trips SET password = 'x'$$, 'permission denied'));

-- A pass for two trips reaches both.
SELECT pg_temp.use(pg_temp.pass(:'GOA' || ',' || :'MNL', pg_temp.later()));
SELECT pg_temp.check('L30 a pass for two trips sees both', (SELECT count(*) FROM trips) = 2);

-- ── Photos and the APK ───────────────────────────────────────────────────────
SELECT pg_temp.check('L31 trip photos cannot be uploaded with the public key',
  pg_temp.raises($$INSERT INTO storage.objects (bucket_id, name) VALUES
    ('trip-media', '11111111-1111-4111-8111-111111111111/bills/eeeeeeee-0000-4000-8000-000000000001.jpg')$$, 'row-level security'));
SELECT pg_temp.check('L32 the trip-media bucket is private',
  (SELECT public FROM storage.buckets WHERE id = 'trip-media') = false);
SELECT pg_temp.check('L33 the published APK cannot be replaced or deleted with the public key',
  pg_temp.raises($$INSERT INTO storage.objects (bucket_id, name) VALUES ('android-app', 'tripmate-latest.apk.new')$$, 'row-level security')
  AND pg_temp.affected($$UPDATE storage.objects SET name = 'x' WHERE bucket_id = 'android-app'$$) = 0
  AND pg_temp.affected($$DELETE FROM storage.objects WHERE bucket_id = 'android-app'$$) = 0);
SELECT pg_temp.check('L34 the APK can still be downloaded',
  EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'android-app' AND name = 'tripmate-latest.apk'));
