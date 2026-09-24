-- ============================================================================
-- TripMate -- storage hardening + keep bill photos after a trip closes
--
-- Run once in the Supabase SQL editor AFTER setup_media.sql
-- (Dashboard -> SQL -> New query -> Run). Safe to re-run.
--
-- What it changes:
--  1. android-app bucket: the anon key can no longer upload or overwrite the
--     release APK. Upload releases with the service-role key
--     (scripts/upload-apk-to-supabase.mjs), which bypasses these policies.
--  2. trip-media bucket: uploads must use the exact path the apps write,
--     inside a trip that exists:
--       <trip uuid>/(bills|payments|payment_proofs)/<uuid>.(jpg|jpeg|png|webp)
--     Deletes are limited to images no attachments row still points to
--     (the apps delete the row first, then the image).
--  3. attachments rows must point at an image inside their own trip folder.
--  4. Closing a trip no longer deletes its bill photos and UPI screenshots.
--     Trips close automatically once everyone is settled, and those images are
--     the record of who paid whom.
--
-- Plain ASCII only (copying from a web page can turn spaces into U+00A0).
-- ============================================================================

-- --- 1. Path rule shared by the trip-media policies --------------------------
CREATE OR REPLACE FUNCTION public.tm_media_path_ok(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments|payment_proofs)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
     AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = split_part(p_name, '/', 1)::uuid);
$$;

REVOKE ALL ON FUNCTION public.tm_media_path_ok(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_media_path_ok(TEXT) TO anon, authenticated;

-- Is this object still referenced by an attachments row?
CREATE OR REPLACE FUNCTION public.tm_media_in_use(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.attachments a WHERE a.storage_path = p_name);
$$;

REVOKE ALL ON FUNCTION public.tm_media_in_use(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tm_media_in_use(TEXT) TO anon, authenticated;

-- --- 2. Replace the broad policies --------------------------------------------
DROP POLICY IF EXISTS "android_app_insert" ON storage.objects;
DROP POLICY IF EXISTS "android_app_update" ON storage.objects;
DROP POLICY IF EXISTS "android_app_delete" ON storage.objects;
-- android_app_select (public download) is kept.

DROP POLICY IF EXISTS "tripmate_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_update" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "tripmate_media_delete_orphans" ON storage.objects;

CREATE POLICY "tripmate_media_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'trip-media' AND public.tm_media_path_ok(name));

-- Kept (path-restricted) because installed 4.0.1 apps upload with upsert.
-- See "Later" at the end of this file to make images write-once.
CREATE POLICY "tripmate_media_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'trip-media' AND public.tm_media_path_ok(name))
  WITH CHECK (bucket_id = 'trip-media' AND public.tm_media_path_ok(name));

CREATE POLICY "tripmate_media_delete_orphans" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'trip-media' AND NOT public.tm_media_in_use(name));

-- tripmate_media_select is unchanged (the bucket is public; SELECT is also
-- what signed URLs and upserts need).

-- --- 3. attachments rows must point inside their own trip folder -----------
-- Without this a row could say '<trip>/../<other trip>/payments/<id>.jpg'
-- and show another trip's payment screenshot as proof. NOT VALID: enforced
-- for every new or changed row without failing on rows that already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachment_path_shape') THEN
    ALTER TABLE public.attachments ADD CONSTRAINT attachment_path_shape CHECK (
      storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments|payment_proofs)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      AND split_part(storage_path, '/', 1) = trip_id::text
    ) NOT VALID;
  END IF;
END $$;

-- --- 4. Keep images when a trip closes ----------------------------------------
-- The old trigger deleted every image (and attachments row) of a trip when it
-- closed. Rows of a deleted trip are still removed by ON DELETE CASCADE.
DROP TRIGGER IF EXISTS tr_trip_closed_or_deleted ON public.trips;
DROP FUNCTION IF EXISTS public.tm_on_trip_closed_or_deleted();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Later (optional): once no phone runs app 4.0.1 or older, make images
-- write-once so a payment screenshot can never be replaced after upload:
--   DROP POLICY IF EXISTS "tripmate_media_update" ON storage.objects;
--
-- ROLLBACK (restores the previous broad policies; not recommended):
--   ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachment_path_shape;
--   DROP POLICY IF EXISTS "tripmate_media_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "tripmate_media_update" ON storage.objects;
--   DROP POLICY IF EXISTS "tripmate_media_delete_orphans" ON storage.objects;
--   CREATE POLICY "tripmate_media_insert" ON storage.objects FOR INSERT TO anon, authenticated
--     WITH CHECK (bucket_id = 'trip-media');
--   CREATE POLICY "tripmate_media_update" ON storage.objects FOR UPDATE TO anon, authenticated
--     USING (bucket_id = 'trip-media') WITH CHECK (bucket_id = 'trip-media');
--   CREATE POLICY "tripmate_media_delete" ON storage.objects FOR DELETE TO anon, authenticated
--     USING (bucket_id = 'trip-media');
--   CREATE POLICY "android_app_insert" ON storage.objects FOR INSERT TO anon, authenticated
--     WITH CHECK (bucket_id = 'android-app');
--   CREATE POLICY "android_app_update" ON storage.objects FOR UPDATE TO anon, authenticated
--     USING (bucket_id = 'android-app') WITH CHECK (bucket_id = 'android-app');
-- ============================================================================
