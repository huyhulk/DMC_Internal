ALTER TABLE public.hr_daily
  ADD COLUMN IF NOT EXISTS transfer_records JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.hr_daily
SET transfer_records = '[]'::jsonb
WHERE transfer_records IS NULL;
