#!/usr/bin/env bash
# Applies schema.sql -> setup_media.sql -> 20260925_harden_storage.sql (twice,
# to prove it is idempotent) to a throwaway database on a local PostgreSQL,
# then runs storage_policies.test.sql as the anon role.
#
#   bash supabase/tests/run-storage-policy-test.sh
#
# Needs psql access as a superuser (default: `runuser -u postgres`). Override with
# PSQL="psql -h localhost -U postgres" if your setup differs.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="tm_policy_test_$$"
PSQL="${PSQL:-runuser -u postgres -- psql}"
run() { $PSQL -v ON_ERROR_STOP=1 -q "$@"; }

cleanup() { $PSQL -q -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

$PSQL -q -c "CREATE DATABASE $DB" >/dev/null

# Supabase roles + a minimal storage schema (buckets, objects with RLS).
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
CREATE PUBLICATION supabase_realtime;
SQL

run -d "$DB" < schema.sql >/dev/null
run -d "$DB" < setup_media.sql >/dev/null
run -d "$DB" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated" >/dev/null
if [ "${SKIP_MIGRATION:-0}" = 1 ]; then
  echo "SKIP_MIGRATION=1: testing the OLD policies (checks are expected to FAIL)"
else
  run -d "$DB" < migrations/20260925_harden_storage.sql >/dev/null
  run -d "$DB" < migrations/20260925_harden_storage.sql >/dev/null   # idempotent re-run
  run -d "$DB" < setup_media.sql >/dev/null   # re-running setup must not reopen anything
  echo "migration applied twice (idempotent); setup_media.sql re-run afterwards"
fi

run -d "$DB" -tA < tests/storage_policies.test.sql 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: //' -e '/^$/d'
