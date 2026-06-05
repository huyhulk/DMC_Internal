-- ============================================================
-- 043: Google Sheet sync auto schedule + RPC date casts
-- Fixes rpc_apply_google_sheet_sync JSON text values being
-- assigned directly into typed data columns during Run sync.
-- ============================================================

BEGIN;

ALTER TABLE public.google_sheet_sync_configs
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_sync_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS auto_sync_timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

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
    NULLIF(record."INITIALDATE", '')::DATE,
    record."CUSTOMER",
    record."WORKSHOP",
    record."DESCRIPTION",
    record."QUANTITY",
    NULLIF(record."DEADLINEDATE", '')::TIMESTAMP WITHOUT TIME ZONE,
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

NOTIFY pgrst, 'reload schema';

COMMIT;
