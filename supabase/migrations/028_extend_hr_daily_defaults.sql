ALTER TABLE public.hr_daily
  ADD COLUMN IF NOT EXISTS transferred_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_filled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_filled_at TIMESTAMPTZ;

UPDATE public.hr_daily
SET transferred_ids = '{}'
WHERE transferred_ids IS NULL;
