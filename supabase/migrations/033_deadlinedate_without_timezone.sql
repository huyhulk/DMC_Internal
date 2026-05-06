-- Normalize data.DEADLINEDATE to local planned deadline without timezone conversion.
-- Run on staging first; apply to production manually after verification.

DO $$
DECLARE
  v_data_kind "char";
BEGIN
  SELECT c.relkind
  INTO v_data_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'v_data';

  IF v_data_kind IS NOT NULL AND v_data_kind <> 'v' THEN
    RAISE EXCEPTION 'public.v_data exists but is not a normal view; aborting to avoid destructive changes';
  END IF;
END $$;

DROP VIEW IF EXISTS public.v_data;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'data'
      AND column_name = 'DEADLINEDATE'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE public.data
      ALTER COLUMN "DEADLINEDATE" TYPE timestamp without time zone
      USING "DEADLINEDATE" AT TIME ZONE 'Asia/Ho_Chi_Minh';
  END IF;
END $$;

CREATE VIEW public.v_data AS
SELECT
  id,
  "PCODE"        AS pcode,
  "WORKSHOP"     AS workshop,
  "CUSTOMER"     AS customer,
  "DESCRIPTION"  AS description,
  "QUANTITY"     AS quantity,
  "DEADLINEDATE" AS deadline_date,
  "INITIALDATE"  AS initial_date,
  "STATUS"       AS status,
  created_at,
  updated_at
FROM public.data;

GRANT SELECT ON public.v_data TO authenticated;
