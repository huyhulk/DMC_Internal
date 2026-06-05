-- ============================================================
-- 044: Google Sheet sync interval schedule
-- Switches auto sync from daily time window to every X minutes.
-- ============================================================

BEGIN;

ALTER TABLE public.google_sheet_sync_configs
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_sync_time TEXT NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS auto_sync_timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN IF NOT EXISTS auto_sync_interval_minutes INTEGER NOT NULL DEFAULT 1440;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'google_sheet_sync_configs_auto_sync_interval_minutes_check'
  ) THEN
    ALTER TABLE public.google_sheet_sync_configs
      ADD CONSTRAINT google_sheet_sync_configs_auto_sync_interval_minutes_check
      CHECK (
        auto_sync_interval_minutes >= 5
        AND auto_sync_interval_minutes <= 1440
        AND auto_sync_interval_minutes % 5 = 0
      );
  END IF;
END $$;

COMMIT;
