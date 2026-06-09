-- ============================================================
-- 045: Google Sheet sync default interval 5 minutes
-- Align external cron cadence with the default auto sync interval.
-- ============================================================

BEGIN;

ALTER TABLE public.google_sheet_sync_configs
  ALTER COLUMN auto_sync_interval_minutes SET DEFAULT 5;

UPDATE public.google_sheet_sync_configs
SET
  auto_sync_interval_minutes = 5,
  updated_at = NOW()
WHERE id = (
  SELECT id
  FROM public.google_sheet_sync_configs
  ORDER BY updated_at DESC
  LIMIT 1
)
AND auto_sync_interval_minutes = 1440;

COMMIT;
