-- ============================================================
-- 041: Google Sheet pull sync configuration
-- Allows the web app to read Google Sheets server-side and sync
-- into public.data without storing Google credentials in the DB.
-- ============================================================

BEGIN;

ALTER TABLE public.data
  ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT 'google_sheet',
  ADD COLUMN IF NOT EXISTS source_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_data_active_source
  ON public.data ("INITIALDATE", "PCODE")
  WHERE source_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_data_source_last_seen_at
  ON public.data (source_last_seen_at);

CREATE INDEX IF NOT EXISTS idx_data_source_deleted_at
  ON public.data (source_deleted_at)
  WHERE source_deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.google_sheet_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Google Sheet sản xuất',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sheet_a_file_id TEXT NOT NULL DEFAULT '',
  sheet_a_tab_name TEXT NOT NULL DEFAULT 'Tổng hợp 2026',
  sheet_c_file_id TEXT,
  sheet_c_tab_name TEXT NOT NULL DEFAULT 'STEP3',
  sheet_b_file_id TEXT,
  sheet_b_tab_name TEXT NOT NULL DEFAULT 'OnlyView',
  sheet_b_pcode_col TEXT NOT NULL DEFAULT 'số YCSX',
  sheet_b_status_col TEXT NOT NULL DEFAULT 'Tình trạng',
  sheet_b_override_statuses TEXT[] NOT NULL DEFAULT ARRAY['Đã giao', 'Đang SX'],
  cutoff_date DATE,
  default_status TEXT NOT NULL DEFAULT 'Chưa SX',
  sheet_c_status TEXT NOT NULL DEFAULT 'Đang kiểm',
  source_name TEXT NOT NULL DEFAULT 'google_sheet',
  soft_delete_missing BOOLEAN NOT NULL DEFAULT TRUE,
  soft_delete_reason TEXT NOT NULL DEFAULT 'missing_from_google_sheet_reconcile',
  max_soft_delete_ratio NUMERIC NOT NULL DEFAULT 0.2 CHECK (max_soft_delete_ratio >= 0 AND max_soft_delete_ratio <= 1),
  column_map JSONB NOT NULL DEFAULT '[
    {"src":"số YCSX","dest":"PCODE","required":true,"type":"text"},
    {"src":"Ngày lập phiếu","dest":"INITIALDATE","required":true,"type":"date"},
    {"src":"Khách hàng","dest":"CUSTOMER","required":false,"type":"text"},
    {"src":"Xưởng Sản Xuất","dest":"WORKSHOP","required":false,"type":"text"},
    {"src":"Diễn giải","dest":"DESCRIPTION","required":false,"type":"text"},
    {"src":"Số lượng","dest":"QUANTITY","required":false,"type":"number"},
    {"src":"Ngày KD","dest":"DEADLINEDATE","required":false,"type":"datetime"}
  ]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_sheet_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.google_sheet_sync_configs(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('test', 'preview', 'run')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sheet_rows_read INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  unchanged_rows INTEGER NOT NULL DEFAULT 0,
  soft_deleted_rows INTEGER NOT NULL DEFAULT 0,
  status_overrides INTEGER NOT NULL DEFAULT 0,
  default_status_applied INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_sheet_sync_runs_started_at
  ON public.google_sheet_sync_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_sheet_sync_runs_config_id
  ON public.google_sheet_sync_runs (config_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_sheet_sync_one_running_run
  ON public.google_sheet_sync_runs ((mode))
  WHERE mode = 'run' AND status = 'running';

CREATE OR REPLACE FUNCTION public.rpc_apply_google_sheet_sync(
  p_records JSONB,
  p_soft_delete_pcodes TEXT[],
  p_source_name TEXT,
  p_deleted_at TIMESTAMPTZ,
  p_soft_delete_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.data (
    "PCODE",
    "INITIALDATE",
    "CUSTOMER",
    "WORKSHOP",
    "DESCRIPTION",
    "QUANTITY",
    "DEADLINEDATE",
    "STATUS",
    source_name,
    source_last_seen_at,
    source_deleted_at,
    source_deleted_reason
  )
  SELECT
    record."PCODE",
    record."INITIALDATE",
    record."CUSTOMER",
    record."WORKSHOP",
    record."DESCRIPTION",
    record."QUANTITY",
    record."DEADLINEDATE",
    record."STATUS",
    record.source_name,
    record.source_last_seen_at,
    record.source_deleted_at,
    record.source_deleted_reason
  FROM jsonb_to_recordset(COALESCE(p_records, '[]'::jsonb)) AS record(
    "PCODE" TEXT,
    "INITIALDATE" TEXT,
    "CUSTOMER" TEXT,
    "WORKSHOP" TEXT,
    "DESCRIPTION" TEXT,
    "QUANTITY" NUMERIC,
    "DEADLINEDATE" TEXT,
    "STATUS" TEXT,
    source_name TEXT,
    source_last_seen_at TIMESTAMPTZ,
    source_deleted_at TIMESTAMPTZ,
    source_deleted_reason TEXT
  )
  ON CONFLICT ("PCODE") DO UPDATE SET
    "INITIALDATE" = EXCLUDED."INITIALDATE",
    "CUSTOMER" = EXCLUDED."CUSTOMER",
    "WORKSHOP" = EXCLUDED."WORKSHOP",
    "DESCRIPTION" = EXCLUDED."DESCRIPTION",
    "QUANTITY" = EXCLUDED."QUANTITY",
    "DEADLINEDATE" = EXCLUDED."DEADLINEDATE",
    "STATUS" = EXCLUDED."STATUS",
    source_name = EXCLUDED.source_name,
    source_last_seen_at = EXCLUDED.source_last_seen_at,
    source_deleted_at = EXCLUDED.source_deleted_at,
    source_deleted_reason = EXCLUDED.source_deleted_reason;

  IF COALESCE(array_length(p_soft_delete_pcodes, 1), 0) > 0 THEN
    UPDATE public.data
    SET
      source_deleted_at = p_deleted_at,
      source_deleted_reason = p_soft_delete_reason
    WHERE "PCODE" = ANY(p_soft_delete_pcodes)
      AND source_name = p_source_name;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_apply_google_sheet_sync(JSONB, TEXT[], TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.touch_google_sheet_sync_configs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_sheet_sync_configs_updated_at ON public.google_sheet_sync_configs;
CREATE TRIGGER trg_google_sheet_sync_configs_updated_at
BEFORE UPDATE ON public.google_sheet_sync_configs
FOR EACH ROW
EXECUTE FUNCTION public.touch_google_sheet_sync_configs_updated_at();

ALTER TABLE public.google_sheet_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheet_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_sheet_sync_configs_admin_select
ON public.google_sheet_sync_configs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
);

CREATE POLICY google_sheet_sync_configs_admin_all
ON public.google_sheet_sync_configs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
);

CREATE POLICY google_sheet_sync_runs_admin_select
ON public.google_sheet_sync_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
);

CREATE POLICY google_sheet_sync_runs_admin_all
ON public.google_sheet_sync_runs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
);

INSERT INTO public.role_tab_permissions (role, permission_key, level)
VALUES
  ('ADMIN', 'admin.google-sheet-sync', 'edit'),
  ('MANAGER', 'admin.google-sheet-sync', 'invisible'),
  ('WORKSHOP_MANAGER', 'admin.google-sheet-sync', 'invisible'),
  ('TEAM_LEADER', 'admin.google-sheet-sync', 'invisible'),
  ('MAINTENANCE', 'admin.google-sheet-sync', 'invisible'),
  ('COORDINATION', 'admin.google-sheet-sync', 'invisible'),
  ('SALES', 'admin.google-sheet-sync', 'invisible'),
  ('HR', 'admin.google-sheet-sync', 'invisible')
ON CONFLICT (role, permission_key) DO UPDATE
SET level = EXCLUDED.level;

COMMIT;
