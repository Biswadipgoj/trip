#!/usr/bin/env bash
# End-to-end test of the server-side login against a local Supabase-shaped stack:
#   PostgreSQL (all migrations) → PostgREST 12 behind /rest/v1 → `next build && next start`
#   → Chromium (Playwright) running e2e/auth/auth.e2e.mjs.
#
#   npm run test:e2e:auth
#
# Needs: a local PostgreSQL 16 you can reach as superuser (default `runuser -u postgres`;
# override with PSQL="psql -h localhost -U postgres"), network once to download PostgREST,
# and Playwright's Chromium (set CHROMIUM_PATH to use an installed one).
# Note: rebuilds .next with test settings; run `npm run build` again before deploying locally.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
CACHE="$ROOT/e2e/.cache"; mkdir -p "$CACHE"
DB="tm_e2e_$$"
PSQL="${PSQL:-runuser -u postgres -- psql}"
PGRST_VERSION=12.2.3
JWT_SECRET="e2e-postgrest-jwt-secret-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
PIDS=()

cleanup() {
  # Each service runs in its own process group (setsid), so killing the group also
  # stops children such as the next-server that `next start` spawns.
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill -- "-$p" 2>/dev/null || true; done
  sleep 1
  $PSQL -q -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT
q() { $PSQL -v ON_ERROR_STOP=1 -q "$@" 2> >(grep -vE "^(NOTICE|WARNING|HINT|DETAIL)" >&2); }

# A leftover server on one of these ports would silently answer instead of ours.
for port in 3001 3100 54321; do
  if (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "port $port is already in use; stop whatever is running there first" >&2; exit 1
  fi
done

# ── Database: Supabase roles, stub storage schema, every migration ────────────
$PSQL -q -c "CREATE DATABASE $DB" >/dev/null
q -d "$DB" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tm_e2e_authenticator') THEN
    CREATE ROLE tm_e2e_authenticator LOGIN NOINHERIT PASSWORD 'tm-e2e-pass';
  END IF;
END $$;
GRANT anon, authenticated, service_role TO tm_e2e_authenticator;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT false, file_size_limit BIGINT, allowed_mime_types TEXT[]);
CREATE TABLE storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT REFERENCES storage.buckets(id), name TEXT, owner UUID, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (bucket_id, name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage, public TO anon, authenticated, service_role;
-- Supabase's default grants: every new public table/function is open to the API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
SQL
q -d "$DB" -o /dev/null < supabase/schema.sql
q -d "$DB" -o /dev/null < supabase/migrations/20260928_production_security_hardening.sql
q -d "$DB" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role" \
          -c "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role"
q -d "$DB" -o /dev/null < supabase/migrations/20260929_protect_member_pins.sql
q -d "$DB" -o /dev/null < supabase/migrations/20260930_auth_sessions.sql
# Supabase's service_role keeps full rights regardless of the anon revokes.
q -d "$DB" -c "GRANT ALL ON public.auth_sessions, public.auth_rate_limits, public.member_pins TO service_role" \
          -c "GRANT EXECUTE ON FUNCTION public.tm_rate_hit(TEXT,INT,INT), public.tm_auth_cleanup() TO service_role"
q -d "$DB" <<'SQL'
INSERT INTO trips (id, trip_code, name, password, status, created_at) VALUES
 ('11111111-1111-4111-8111-111111111111','TRP-GOA1','Goa Beach Week','pw','active','2026-09-20'),
 ('22222222-2222-4222-8222-222222222222','TRP-MNL1','Manali Snow','pw','closed','2026-03-01');
INSERT INTO members (id, trip_id, name, mobile, pin) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Asha','9876543210','1234'),
 ('aaaaaaaa-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Ravi','9123456780','1111'),
 ('aaaaaaaa-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','Asha','9876543210','5678');
SQL
echo "database $DB ready (all migrations applied)"

# ── PostgREST behind /rest/v1, Supabase-style anon + service keys ─────────────
PGRST="$CACHE/postgrest-$PGRST_VERSION"
if [ ! -x "$PGRST" ]; then
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/v$PGRST_VERSION/postgrest-v$PGRST_VERSION-linux-static-x64.tar.xz" \
    | tar -xJ -C "$CACHE" && mv "$CACHE/postgrest" "$PGRST"
fi
cat > "$CACHE/pgrst.conf" <<EOF
db-uri = "postgres://tm_e2e_authenticator:tm-e2e-pass@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
EOF
setsid "$PGRST" "$CACHE/pgrst.conf" > "$CACHE/postgrest.log" 2>&1 & PIDS+=($!)
setsid node e2e/auth/proxy.mjs > "$CACHE/proxy.log" 2>&1 & PIDS+=($!)
KEYS=$(JWT_SECRET="$JWT_SECRET" node --input-type=module -e "
import { SignJWT } from 'jose'
const k = new TextEncoder().encode(process.env.JWT_SECRET)
const mk = role => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt().setExpirationTime('2h').sign(k)
console.log(await mk('anon'), await mk('service_role'))")
read -r ANON SERVICE <<< "$KEYS"

# ── The app, pointed at the local stack ───────────────────────────────────────
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE" SESSION_SECRET="e2e-session-secret-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
npx next build > "$CACHE/next-build.log" 2>&1 || { tail -30 "$CACHE/next-build.log"; exit 1; }
setsid npx next start -p 3100 > "$CACHE/next-start.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3100 && break; sleep 1; done

node e2e/auth/auth.e2e.mjs
