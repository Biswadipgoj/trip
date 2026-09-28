CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

-- TripMate: server-side login sessions (safe to run more than once).
-- Only the Next.js server (service-role key) touches these tables. RLS is on
-- with no policies and every grant is revoked, so the public anon key can
-- neither read nor write them.

-- One row per logged-in browser or phone. Stores only a SHA-256 hash of the
-- refresh token, never the token itself. The previous hash is kept briefly so
-- two tabs refreshing at once are not mistaken for a stolen token.
CREATE TABLE IF NOT EXISTS public.auth_sessions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
refresh_hash TEXT NOT NULL UNIQUE,
prev_refresh_hash TEXT,
rotated_at TIMESTAMPTZ,
memberships JSONB NOT NULL DEFAULT '[]'::jsonb,
user_agent TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
expires_at TIMESTAMPTZ NOT NULL,
revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_prev_hash ON public.auth_sessions (prev_refresh_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON public.auth_sessions (expires_at);

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_sessions FROM PUBLIC, anon, authenticated;

-- Fixed-window rate limiter for login endpoints.
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
key TEXT PRIMARY KEY,
hits INT NOT NULL,
window_start TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_limits FROM PUBLIC, anon, authenticated;

-- Records one hit for p_key and returns true while the caller is within
-- p_limit hits per p_window_seconds. Atomic under concurrent requests.
CREATE OR REPLACE FUNCTION public.tm_rate_hit(p_key TEXT, p_limit INT, p_window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_hits INT;
BEGIN
INSERT INTO public.auth_rate_limits AS r (key, hits, window_start)
VALUES (p_key, 1, now())
ON CONFLICT (key) DO UPDATE
SET hits = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.hits + 1 END,
window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
RETURNING hits INTO v_hits;
RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_rate_hit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;

-- Housekeeping: drop expired sessions and stale rate-limit windows.
CREATE OR REPLACE FUNCTION public.tm_auth_cleanup()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
DELETE FROM public.auth_sessions WHERE expires_at < now() - interval '1 day' OR revoked_at < now() - interval '1 day';
DELETE FROM public.auth_rate_limits WHERE window_start < now() - interval '1 day';
$$;

REVOKE ALL ON FUNCTION public.tm_auth_cleanup() FROM PUBLIC, anon, authenticated;
