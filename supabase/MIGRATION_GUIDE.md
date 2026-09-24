# TripMate — Supabase Media & Cloud Sync Setup Guide

TripMate mobile features **local-first image persistence**. Bill photos and UPI payment screenshots are saved instantly to the device's permanent storage (`tripmate-media`) and remain 100% visible, zoomable, and usable even when offline or before backend storage is configured.

To enable multi-device cloud synchronization of photos and receipts across all trip members, run the pure ASCII migration script below in your Supabase project.

---

## Why Did the Syntax Error Occur?

In PostgreSQL, the error:
```
ERROR: 42601: syntax error at or near " "
LINE 18:   SET public = EXCLUDED.public,
```
occurs when copying from a browser or rich-text viewer converts leading spaces into Unicode non-breaking spaces (`\u00A0` / `&nbsp;`). Postgres does not consider `\u00A0` to be whitespace and throws a syntax error.

We have:
1. Replaced `ON CONFLICT (id) DO UPDATE SET ...` with `ON CONFLICT (id) DO NOTHING;` (clean single line).
2. Removed all Unicode punctuation and non-ASCII characters.
3. Created a clean file [`supabase/setup_media.sql`](./setup_media.sql) that you can directly upload or copy.

---

## Option A: Upload the File (Safest — No Copy/Paste Glitches)

1. Open your Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor**.
3. Click the folder icon or **Upload script** button at the top.
4. Select [`supabase/setup_media.sql`](./setup_media.sql) from your project folder.
5. Click **Run**.

---

## Option B: Copy & Paste This Clean SQL

```sql
-- ============================================================================
-- TripMate mobile -- bill photos, UPI payment screenshots, atomic writes
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --- 1. Storage bucket -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trip-media', 'trip-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- --- 2. attachments table ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attachments (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id          UUID          NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind             TEXT          NOT NULL CHECK (kind IN ('bill', 'payment_proof')),
  expense_id       UUID          REFERENCES public.expenses(id) ON DELETE CASCADE,
  hotel_expense_id UUID          REFERENCES public.hotel_expenses(id) ON DELETE CASCADE,
  settlement_id    UUID,
  from_member_id   UUID          REFERENCES public.members(id) ON DELETE CASCADE,
  to_member_id     UUID          REFERENCES public.members(id) ON DELETE CASCADE,
  amount           NUMERIC(12, 2),
  storage_path     TEXT          NOT NULL UNIQUE,
  mime_type        TEXT          NOT NULL DEFAULT 'image/jpeg',
  width            INTEGER,
  height           INTEGER,
  size_bytes       INTEGER,
  uploaded_by      UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT attachment_target CHECK (
    (kind = 'bill' AND (expense_id IS NOT NULL) <> (hotel_expense_id IS NOT NULL))
    OR (kind = 'payment_proof' AND from_member_id IS NOT NULL AND to_member_id IS NOT NULL)
  ),
  CONSTRAINT attachment_path_in_trip CHECK (storage_path LIKE trip_id::text || '/%')
);

CREATE INDEX IF NOT EXISTS idx_attachments_trip     ON public.attachments (trip_id);
CREATE INDEX IF NOT EXISTS idx_attachments_expense  ON public.attachments (expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_hotel    ON public.attachments (hotel_expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_payment  ON public.attachments (trip_id, from_member_id, to_member_id);

-- Same access model as the other trip tables (anon key, allow-all RLS).
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attachments' AND policyname = 'allow_all_attachments'
  ) THEN
    CREATE POLICY "allow_all_attachments" ON public.attachments
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Live updates to other phones.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- --- 3. Storage policies -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tripmate_media_insert'
  ) THEN
    CREATE POLICY "tripmate_media_insert" ON storage.objects
      FOR INSERT TO anon, authenticated
      WITH CHECK (
        bucket_id = 'trip-media'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
        AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id::text = split_part(name, '/', 1))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tripmate_media_update'
  ) THEN
    CREATE POLICY "tripmate_media_update" ON storage.objects
      FOR UPDATE TO anon, authenticated
      USING (
        bucket_id = 'trip-media'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      )
      WITH CHECK (
        bucket_id = 'trip-media'
        AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(bills|payments)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tripmate_media_select'
  ) THEN
    CREATE POLICY "tripmate_media_select" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'trip-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tripmate_media_delete_orphans'
  ) THEN
    CREATE POLICY "tripmate_media_delete_orphans" ON storage.objects
      FOR DELETE TO anon, authenticated
      USING (
        bucket_id = 'trip-media'
        AND NOT EXISTS (SELECT 1 FROM public.attachments a WHERE a.storage_path = name)
      );
  END IF;
END $$;

-- --- 4. Atomic, idempotent writes used by the Android app --------------------

CREATE OR REPLACE FUNCTION public.tm_push_expense(p_expense JSONB, p_participants JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id   UUID := (p_expense->>'id')::UUID;
  v_elem JSONB;
BEGIN
  INSERT INTO expenses (id, trip_id, title, amount, paid_by, category, split_type, notes, created_at)
  VALUES (
    v_id,
    (p_expense->>'trip_id')::UUID,
    p_expense->>'title',
    (p_expense->>'amount')::NUMERIC,
    (p_expense->>'paid_by')::UUID,
    COALESCE(p_expense->>'category', 'misc')::expense_category,
    COALESCE(p_expense->>'split_type', 'equal')::split_type,
    p_expense->>'notes',
    COALESCE((p_expense->>'created_at')::TIMESTAMPTZ, NOW())
  )
  ON CONFLICT (id) DO NOTHING;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_participants, '[]'::JSONB))
  LOOP
    INSERT INTO expense_participants (expense_id, member_id, split_value, resolved_amount)
    VALUES (
      v_id,
      (v_elem->>'member_id')::UUID,
      COALESCE((v_elem->>'split_value')::NUMERIC, 0),
      COALESCE((v_elem->>'resolved_amount')::NUMERIC, 0)
    )
    ON CONFLICT (expense_id, member_id) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tm_push_hotel_expense(p_hotel JSONB, p_rooms JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id      UUID := (p_hotel->>'id')::UUID;
  v_trip    UUID := (p_hotel->>'trip_id')::UUID;
  v_room    JSONB;
  v_room_id UUID;
  v_occ     TEXT;
BEGIN
  INSERT INTO hotel_expenses (id, trip_id, title, total_amount, paid_by, created_at)
  VALUES (
    v_id,
    v_trip,
    p_hotel->>'title',
    (p_hotel->>'total_amount')::NUMERIC,
    (p_hotel->>'paid_by')::UUID,
    COALESCE((p_hotel->>'created_at')::TIMESTAMPTZ, NOW())
  )
  ON CONFLICT (id) DO NOTHING;

  FOR v_room IN SELECT * FROM jsonb_array_elements(COALESCE(p_rooms, '[]'::JSONB))
  LOOP
    v_room_id := CASE
      WHEN (v_room->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (v_room->>'id')::UUID
      ELSE uuid_generate_v4()
    END;
    INSERT INTO rooms (id, hotel_expense_id, trip_id, name, cost)
    VALUES (v_room_id, v_id, v_trip, COALESCE(v_room->>'name', 'Room'), COALESCE((v_room->>'cost')::NUMERIC, 0))
    ON CONFLICT (id) DO NOTHING;

    FOR v_occ IN SELECT * FROM jsonb_array_elements_text(COALESCE(v_room->'occupant_ids', '[]'::JSONB))
    LOOP
      INSERT INTO room_occupants (room_id, member_id)
      VALUES (v_room_id, v_occ::UUID)
      ON CONFLICT (room_id, member_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tm_push_settlement_group(p_group JSONB, p_member_ids JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id     UUID := (p_group->>'id')::UUID;
  v_member TEXT;
BEGIN
  INSERT INTO settlement_groups (id, trip_id, name)
  VALUES (v_id, (p_group->>'trip_id')::UUID, p_group->>'name')
  ON CONFLICT (id) DO NOTHING;

  FOR v_member IN SELECT * FROM jsonb_array_elements_text(COALESCE(p_member_ids, '[]'::JSONB))
  LOOP
    INSERT INTO settlement_group_members (group_id, member_id)
    VALUES (v_id, v_member::UUID)
    ON CONFLICT (group_id, member_id) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tm_push_expense(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_hotel_expense(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_push_settlement_group(JSONB, JSONB) TO anon, authenticated;

-- --- 5. Auto-delete files when trip is closed or deleted ----------------------
CREATE OR REPLACE FUNCTION public.tm_on_trip_closed_or_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed')) THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'trip-media'
      AND (name LIKE (COALESCE(NEW.id, OLD.id))::text || '/%');

    IF (TG_OP = 'UPDATE') THEN
      DELETE FROM public.attachments WHERE trip_id = NEW.id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_closed_or_deleted ON public.trips;
CREATE TRIGGER tr_trip_closed_or_deleted
  AFTER UPDATE OF status OR DELETE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.tm_on_trip_closed_or_deleted();

-- Make the new table and functions visible to the API immediately.
NOTIFY pgrst, 'reload schema';
```

---

## Verification

After running the script:
1. Go to **Storage** in Supabase Dashboard: verify `trip-media` bucket is present.
2. Go to **Table Editor**: verify `attachments` table exists under schema `public`.
3. Done! The mobile app will automatically detect the bucket and sync photos.
