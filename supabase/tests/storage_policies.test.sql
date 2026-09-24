-- Policy test for supabase/migrations/20260925_harden_storage.sql.
-- Runs on a plain PostgreSQL 16 with a stub of Supabase's storage schema:
--   bash supabase/tests/run-storage-policy-test.sh
-- Every check prints PASS/FAIL; the script exits non-zero on the first FAIL.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.expect(label TEXT, sql TEXT, should_succeed BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN := true; n BIGINT := 0; msg TEXT := '';
BEGIN
  BEGIN
    EXECUTE sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    -- RLS hides rows from UPDATE/DELETE instead of raising: 0 rows = denied.
    IF n = 0 THEN ok := false; msg := '0 rows affected'; END IF;
  EXCEPTION WHEN OTHERS THEN ok := false; msg := SQLERRM;
  END;
  IF ok = should_succeed THEN
    RAISE NOTICE 'PASS  %', label;
  ELSE
    RAISE EXCEPTION 'FAIL  % (expected %, got %: %)', label,
      CASE WHEN should_succeed THEN 'allowed' ELSE 'denied' END,
      CASE WHEN ok THEN 'allowed' ELSE 'denied' END, msg;
  END IF;
END $$;

-- Fixtures (as the owner, bypassing RLS)
INSERT INTO public.trips (id, trip_code, name, password, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'TEST01', 'Test trip', 'x', 'active');
INSERT INTO public.members (id, trip_id, name, mobile, pin, avatar_color)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'A', '9000000001', '1234', 'hsl(1,1%,1%)');
INSERT INTO public.expenses (id, trip_id, title, amount, paid_by, category, split_type)
VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Dinner', 100, '22222222-2222-4222-8222-222222222222', 'food', 'equal');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('android-app', 'tripmate-latest.apk.part1'),
  ('trip-media', '11111111-1111-4111-8111-111111111111/bills/44444444-4444-4444-8444-444444444444.jpg'),
  ('trip-media', '11111111-1111-4111-8111-111111111111/bills/55555555-5555-4555-8555-555555555555.jpg');
INSERT INTO public.attachments (id, trip_id, kind, expense_id, storage_path)
VALUES ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'bill',
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111/bills/44444444-4444-4444-8444-444444444444.jpg');

SET ROLE anon;

-- T1: the release APK cannot be replaced with the public key
SELECT pg_temp.expect('T1 anon INSERT into android-app is denied',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('android-app', 'tripmate-latest.apk.part2')$q$, false);
SELECT pg_temp.expect('T1 anon UPDATE of an APK part is denied',
  $q$UPDATE storage.objects SET name = name WHERE bucket_id = 'android-app'$q$, false);
SELECT pg_temp.expect('T1 anon DELETE of an APK part is denied',
  $q$DELETE FROM storage.objects WHERE bucket_id = 'android-app'$q$, false);
SELECT pg_temp.expect('T1 anon can still read (download) the APK',
  $q$SELECT 1 FROM storage.objects WHERE bucket_id = 'android-app'$q$, true);

-- T4: uploads must use the app path shape inside an existing trip
SELECT pg_temp.expect('T4 bill upload with the app path is allowed',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', '11111111-1111-4111-8111-111111111111/bills/77777777-7777-4777-8777-777777777777.jpg')$q$, true);
SELECT pg_temp.expect('T4 app payment screenshot path is allowed',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', '11111111-1111-4111-8111-111111111111/payments/88888888-8888-4888-8888-888888888888.jpg')$q$, true);
SELECT pg_temp.expect('T4 legacy web payment_proofs path is allowed',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', '11111111-1111-4111-8111-111111111111/payment_proofs/99999999-9999-4999-8999-999999999999.png')$q$, true);
SELECT pg_temp.expect('T4 upload into a trip that does not exist is denied',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bills/77777777-7777-4777-8777-777777777771.jpg')$q$, false);
SELECT pg_temp.expect('T4 arbitrary path is denied',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', 'junk/evil.html')$q$, false);
SELECT pg_temp.expect('T4 path traversal is denied',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', '11111111-1111-4111-8111-111111111111/bills/../../x.jpg')$q$, false);
SELECT pg_temp.expect('T4 non-image extension is denied',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('trip-media', '11111111-1111-4111-8111-111111111111/bills/77777777-7777-4777-8777-777777777772.svg')$q$, false);

-- T2: update stays inside the path rule (kept for 4.0.1 upsert)
SELECT pg_temp.expect('T2 upsert of a valid object path is allowed',
  $q$UPDATE storage.objects SET name = name WHERE name = '11111111-1111-4111-8111-111111111111/bills/77777777-7777-4777-8777-777777777777.jpg'$q$, true);
SELECT pg_temp.expect('T2 moving an object to an invalid path is denied',
  $q$UPDATE storage.objects SET name = 'junk/x.jpg' WHERE name = '11111111-1111-4111-8111-111111111111/bills/77777777-7777-4777-8777-777777777777.jpg'$q$, false);

-- T3: images still referenced by an attachments row cannot be deleted
SELECT pg_temp.expect('T3 deleting a referenced bill image is denied',
  $q$DELETE FROM storage.objects WHERE name = '11111111-1111-4111-8111-111111111111/bills/44444444-4444-4444-8444-444444444444.jpg'$q$, false);
SELECT pg_temp.expect('T3 deleting an orphaned image is allowed',
  $q$DELETE FROM storage.objects WHERE name = '11111111-1111-4111-8111-111111111111/bills/55555555-5555-4555-8555-555555555555.jpg'$q$, true);

-- ADV-1: an attachments row cannot point outside its own trip folder
SELECT pg_temp.expect('ADV-1 row with a ../ storage path is denied',
  $q$INSERT INTO public.attachments (trip_id, kind, expense_id, storage_path) VALUES ('11111111-1111-4111-8111-111111111111', 'bill', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111/../../android-app/tripmate-latest.apk.part1')$q$, false);
SELECT pg_temp.expect('ADV-1 row pointing into another trip folder is denied',
  $q$INSERT INTO public.attachments (trip_id, kind, expense_id, storage_path) VALUES ('11111111-1111-4111-8111-111111111111', 'bill', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bills/77777777-7777-4777-8777-777777777773.jpg')$q$, false);
SELECT pg_temp.expect('ADV-1 row with the app path is allowed',
  $q$INSERT INTO public.attachments (trip_id, kind, expense_id, storage_path) VALUES ('11111111-1111-4111-8111-111111111111', 'bill', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111/bills/77777777-7777-4777-8777-777777777777.jpg')$q$, true);

RESET ROLE;

-- Closing a trip keeps its images and attachments rows
UPDATE public.trips SET status = 'closed' WHERE id = '11111111-1111-4111-8111-111111111111';
SELECT pg_temp.expect('Closing a trip keeps its attachments rows',
  $q$SELECT 1 FROM public.attachments WHERE trip_id = '11111111-1111-4111-8111-111111111111'$q$, true);
SELECT pg_temp.expect('Closing a trip keeps its images',
  $q$SELECT 1 FROM storage.objects WHERE name = '11111111-1111-4111-8111-111111111111/bills/44444444-4444-4444-8444-444444444444.jpg'$q$, true);

\echo 'ALL STORAGE POLICY CHECKS PASSED'
