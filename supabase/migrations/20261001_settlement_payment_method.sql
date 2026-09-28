ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- TripMate: record whether a settlement was paid by UPI or in cash.
-- NULL means unknown (payments recorded before this change). Safe to re-run.
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settlements_payment_method_check') THEN
ALTER TABLE public.settlements
ADD CONSTRAINT settlements_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('upi', 'cash'));
END IF;
END $$;
