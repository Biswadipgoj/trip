#!/usr/bin/env bash
# Applies schema.sql -> 20260928_production_security_hardening.sql ->
# 20260929_protect_member_pins.sql (twice, to prove it is idempotent) to a
# throwaway database on a local PostgreSQL, then runs member_pins.test.sql as
# the anon role.
#
#   bash supabase/tests/run-member-pin-test.sh
#
# Needs psql access as a superuser (default: `runuser -u postgres`). Override with
# PSQL="psql -h localhost -U postgres" if your setup differs.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="tm_pin_test_$$"
PSQL="${PSQL:-runuser -u postgres -- psql}"
run() { $PSQL -v ON_ERROR_STOP=1 -q "$@" 2> >(grep -vE "^(NOTICE|WARNING|HINT):" >&2); }

cleanup() { $PSQL -q -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

$PSQL -q -c "CREATE DATABASE $DB" >/dev/null

# Supabase roles, a minimal storage schema, and Supabase's default grants
# (anon/authenticated get every privilege on new public tables — the
# migration must revoke them on member_pins).
run -d "$DB" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
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
GRANT USAGE ON SCHEMA storage, public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
GRANT SELECT ON storage.buckets TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
CREATE PUBLICATION supabase_realtime;
SQL

run -d "$DB" < schema.sql >/dev/null
run -d "$DB" < migrations/20260928_production_security_hardening.sql >/dev/null
run -d "$DB" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated" >/dev/null

# Pre-existing data with plain-text PINs, as production has today.
run -d "$DB" <<'SQL'
INSERT INTO trips (id, trip_code, name, password, status, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'TRP-GOA1', 'Goa',    'pw', 'active', '2026-09-01'),
  ('22222222-2222-4222-8222-222222222222', 'TRP-MNL1', 'Manali', 'pw', 'closed', '2026-03-01');
INSERT INTO members (id, trip_id, name, mobile, pin) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Asha', '9876543210', '1234'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Ravi', '9123456780', '1111'),
  ('aaaaaaaa-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Asha', '9876543210', '5678'),
  ('aaaaaaaa-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'Manual', 'manual-aaaaaaaa', '');
SQL

run -d "$DB" < migrations/20260929_protect_member_pins.sql >/dev/null
run -d "$DB" < migrations/20260929_protect_member_pins.sql >/dev/null   # idempotent re-run
echo "migration applied twice (idempotent)"

$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -tA < tests/member_pins.test.sql 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: //' -e '/^$/d'
