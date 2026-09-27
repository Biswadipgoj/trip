CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

-- TripMate: protect member PINs (safe to run more than once).
-- PINs move out of members.pin into member_pins as bcrypt hashes that the
-- public API key cannot read. members.pin is blanked, a PIN can be set only
-- once, PINs are checked on the server, and 5 wrong PINs lock a member for
-- 15 minutes.

CREATE TABLE IF NOT EXISTS public.member_pins (
member_id UUID PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
pin_hash TEXT NOT NULL,
failed_attempts INT NOT NULL DEFAULT 0,
locked_until TIMESTAMPTZ,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.member_pins ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies, and no grants: only SECURITY DEFINER functions below touch it.
REVOKE ALL ON public.member_pins FROM PUBLIC, anon, authenticated;

-- Move existing PINs
INSERT INTO public.member_pins (member_id, pin_hash)
SELECT id, crypt(pin, gen_salt('bf', 8))
FROM public.members
WHERE pin ~ '^[0-9]{4}$'
ON CONFLICT (member_id) DO NOTHING;

UPDATE public.members SET pin = '' WHERE pin <> '';

-- Capture PINs on write
-- AFTER trigger so the member row exists for the foreign key. It fires only
-- when a non-empty PIN arrives, stores the hash (first write wins), then
-- blanks the column. The inner UPDATE sets pin = '', so the WHEN clause stops
-- the trigger from firing again.
CREATE OR REPLACE FUNCTION public.tm_capture_member_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
IF NEW.pin ~ '^[0-9]{4}$' THEN
INSERT INTO public.member_pins (member_id, pin_hash)
VALUES (NEW.id, crypt(NEW.pin, gen_salt('bf', 8)))
ON CONFLICT (member_id) DO NOTHING;
END IF;
UPDATE public.members SET pin = '' WHERE id = NEW.id;
RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_capture_member_pin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tm_members_capture_pin ON public.members;
CREATE TRIGGER tm_members_capture_pin
AFTER INSERT OR UPDATE OF pin ON public.members
FOR EACH ROW
WHEN (NEW.pin <> '')
EXECUTE FUNCTION public.tm_capture_member_pin();

-- Verify a PIN
-- Returns true/false. While the member is locked it raises PIN_LOCKED so the
-- app can say "try again later" instead of "wrong PIN".
CREATE OR REPLACE FUNCTION public.tm_verify_member_pin(p_member_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
r public.member_pins%ROWTYPE;
BEGIN
SELECT * INTO r FROM public.member_pins WHERE member_id = p_member_id FOR UPDATE;
IF NOT FOUND THEN
RETURN false;
END IF;

IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
RAISE EXCEPTION 'PIN_LOCKED' USING ERRCODE = 'P0001';
END IF;

IF r.pin_hash = crypt(coalesce(p_pin, ''), r.pin_hash) THEN
UPDATE public.member_pins
SET failed_attempts = 0, locked_until = NULL, updated_at = now()
WHERE member_id = p_member_id;
RETURN true;
END IF;

-- From the 5th consecutive failure on, every wrong PIN locks for 15 minutes.
UPDATE public.member_pins
SET failed_attempts = r.failed_attempts + 1,
locked_until = CASE WHEN r.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' END,
updated_at = now()
WHERE member_id = p_member_id;
RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tm_verify_member_pin(UUID, TEXT) TO anon, authenticated;

-- Trips for a mobile number (login picker)
-- Only members who have a PIN, since only they can log in.
CREATE OR REPLACE FUNCTION public.tm_find_trips_by_mobile(p_mobile TEXT)
RETURNS TABLE (
member_id UUID,
member_name TEXT,
trip_id UUID,
trip_code TEXT,
trip_name TEXT,
status TEXT,
created_at TIMESTAMPTZ,
member_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT m.id, m.name, t.id, t.trip_code, t.name, t.status::TEXT, t.created_at,
(SELECT count(*)::INT FROM public.members x WHERE x.trip_id = t.id)
FROM public.members m
JOIN public.trips t ON t.id = m.trip_id
JOIN public.member_pins p ON p.member_id = m.id
WHERE p_mobile ~ '^[6-9][0-9]{9}$'
AND m.mobile = p_mobile
ORDER BY (t.status::TEXT = 'active') DESC, t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.tm_find_trips_by_mobile(TEXT) TO anon, authenticated;
