#!/usr/bin/env bash
# Applies every migration (the lock twice, to prove it is idempotent) to a
# throwaway database on a local PostgreSQL, then runs lock_trip_data.test.sql
# as the anon role, the way PostgREST runs API requests.
#
#   bash supabase/tests/run-lock-test.sh
#
# Needs psql access as a superuser (default: `runuser -u postgres`). Override with
# PSQL="psql -h localhost -U postgres" if your setup differs.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="tm_lock_test_$$"
PSQL="${PSQL:-runuser -u postgres -- psql}"
run() { $PSQL -v ON_ERROR_STOP=1 -q "$@" 2> >(grep -vE "^(NOTICE|WARNING|HINT):" >&2); }

cleanup() { $PSQL -q -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

$PSQL -q -c "CREATE DATABASE $DB" >/dev/null

run -d "$DB" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT false,
  file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id), name TEXT, owner UUID,
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage, public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
GRANT SELECT ON storage.buckets TO anon, authenticated;
-- Supabase's default grants: every new public table/function is open to the API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
SQL

run -d "$DB" < schema.sql >/dev/null
run -d "$DB" < setup_media.sql >/dev/null
run -d "$DB" < migrations/20260928_production_security_hardening.sql >/dev/null
run -d "$DB" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role" \
             -c "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role" >/dev/null
run -d "$DB" < migrations/20260929_protect_member_pins.sql >/dev/null
run -d "$DB" < migrations/20260930_auth_sessions.sql >/dev/null
run -d "$DB" < migrations/20261001_settlement_payment_method.sql >/dev/null

run -d "$DB" <<'SQL'
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-media', 'trip-media', true), ('android-app', 'android-app', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.objects (bucket_id, name) VALUES ('android-app', 'tripmate-latest.apk');
INSERT INTO trips (id, trip_code, name, password, status, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'TRP-GOA1', 'Goa',    'pw1', 'active', '2026-09-01'),
  ('22222222-2222-4222-8222-222222222222', 'TRP-MNL1', 'Manali', 'pw2', 'active', '2026-03-01');
INSERT INTO members (id, trip_id, name, mobile, pin) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Asha', '9876543210', '1234'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Ravi', '9123456780', '1111'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Meera', '9000000001', '5678'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Dev',   '9000000002', '8765');
INSERT INTO expenses (id, trip_id, title, amount, paid_by) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Villa', 1000, 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Cafe',  400,  'bbbbbbbb-0000-4000-8000-000000000001');
INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', 1, 500),
  ('eeeeeeee-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 1, 200);
INSERT INTO settlement_groups (id, trip_id, name) VALUES
  ('99999999-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Couple');
INSERT INTO settlements (id, trip_id, from_member_id, to_member_id, amount, status) VALUES
  ('55555555-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 200, 'pending');
SQL

run -d "$DB" < migrations/20261002_lock_trip_data.sql >/dev/null
run -d "$DB" < migrations/20261002_lock_trip_data.sql >/dev/null   # idempotent re-run
echo "lock migration applied twice (idempotent)"
# The server sets the key through the service role; here we set a known test key.
run -d "$DB" -c "SET ROLE service_role; SELECT public.tm_set_db_key(repeat('ab', 32));" >/dev/null

$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -tA < tests/lock_trip_data.test.sql 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: //' -e '/^$/d'

# The emergency rollback really reopens the data (so the guide's undo is true).
run -d "$DB" < rollback/20261002_unlock_trip_data.sql >/dev/null
run -d "$DB" < migrations/20260928_production_security_hardening.sql >/dev/null
n=$($PSQL -q -d "$DB" -tA -c "SET ROLE anon; SELECT count(*) FROM trips;")
[ "$n" = "2" ] && echo "PASS  R1 rollback + 20260928 reopens trips to anon (undo works)" || { echo "FAIL  R1 rollback: anon sees $n trips"; exit 1; }
run -d "$DB" < migrations/20261002_lock_trip_data.sql >/dev/null
n=$($PSQL -q -d "$DB" -tA -c "SET ROLE anon; SELECT count(*) FROM trips;")
[ "$n" = "0" ] && echo "PASS  R2 re-running the lock closes it again" || { echo "FAIL  R2 relock: anon sees $n trips"; exit 1; }
