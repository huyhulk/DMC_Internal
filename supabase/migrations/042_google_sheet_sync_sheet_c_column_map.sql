ALTER TABLE public.google_sheet_sync_configs
  ADD COLUMN IF NOT EXISTS sheet_c_column_map JSONB;
