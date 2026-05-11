-- ============================================================
-- 037: Progress report RPC
-- Pushes production-progress source loading into PostgreSQL so the
-- Next.js report handler can use one RPC call instead of multiple
-- table round-trips, while keeping TypeScript status rules unchanged.
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_fetch_progress_rows(DATE, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_fetch_progress_rows(
  p_from          DATE,
  p_to            DATE,
  p_workshop_code TEXT DEFAULT NULL,
  p_filter_by     TEXT DEFAULT 'deadline'
)
RETURNS TABLE (
  pcode                  TEXT,
  workshop               TEXT,
  description            TEXT,
  customer               TEXT,
  quantity               NUMERIC,
  initialdate            TEXT,
  deadlinedate           TEXT,
  source_status          TEXT,
  production_rows        JSONB,
  period_production_rows JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized_data AS (
    SELECT
      d."PCODE"::TEXT AS pcode,
      CASE
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 1%' THEN 'DMC1'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 2%' THEN 'DMC1'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 3%' THEN 'DMC3'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 4%' THEN 'DMC4'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 5%' THEN 'DMC5'
        WHEN d."WORKSHOP" ILIKE 'DMC1%'          THEN 'DMC1'
        WHEN d."WORKSHOP" ILIKE 'DMC3%'          THEN 'DMC3'
        WHEN d."WORKSHOP" ILIKE 'DMC4%'          THEN 'DMC4'
        WHEN d."WORKSHOP" ILIKE 'DMC5%'          THEN 'DMC5'
        ELSE 'DMC1'
      END AS workshop,
      COALESCE(d."DESCRIPTION", '')::TEXT AS description,
      COALESCE(d."CUSTOMER", '')::TEXT AS customer,
      COALESCE(d."QUANTITY", 0)::NUMERIC AS quantity,
      d."INITIALDATE" AS initialdate_date,
      d."DEADLINEDATE" AS deadlinedate_ts,
      COALESCE(d."STATUS", '')::TEXT AS source_status
    FROM data d
    WHERE d."PCODE" IS NOT NULL
      AND (
        p_workshop_code IS NULL
        OR (p_workshop_code = 'DMC1' AND (d."WORKSHOP" ILIKE 'Phân xưởng 1%' OR d."WORKSHOP" ILIKE 'Phân xưởng 2%' OR d."WORKSHOP" ILIKE 'DMC1%'))
        OR (p_workshop_code = 'DMC3' AND (d."WORKSHOP" ILIKE 'Phân xưởng 3%' OR d."WORKSHOP" ILIKE 'DMC3%'))
        OR (p_workshop_code = 'DMC4' AND (d."WORKSHOP" ILIKE 'Phân xưởng 4%' OR d."WORKSHOP" ILIKE 'DMC4%'))
        OR (p_workshop_code = 'DMC5' AND (d."WORKSHOP" ILIKE 'Phân xưởng 5%' OR d."WORKSHOP" ILIKE 'DMC5%'))
      )
  )
  SELECT
    nd.pcode,
    nd.workshop,
    nd.description,
    nd.customer,
    nd.quantity,
    COALESCE(nd.initialdate_date::TEXT, '') AS initialdate,
    COALESCE(to_char(nd.deadlinedate_ts AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS deadlinedate,
    nd.source_status,
    COALESCE(all_prod.production_rows, '[]'::JSONB) AS production_rows,
    CASE
      WHEN COALESCE(p_filter_by, 'deadline') IN ('production_date', 'completed_date')
        THEN COALESCE(period_prod.production_rows, '[]'::JSONB)
      ELSE NULL
    END AS period_production_rows
  FROM normalized_data nd
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'pcode', p.pcode,
        'poutput', COALESCE(p.poutput, 0),
        'pdate', p.pdate,
        'endtime', p.endtime,
        'save_status', p.save_status
      )
      ORDER BY p.pdate, p.endtime
    ) AS production_rows
    FROM "Production" p
    WHERE p.pcode = nd.pcode
  ) all_prod ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'pcode', p.pcode,
        'poutput', COALESCE(p.poutput, 0),
        'pdate', p.pdate,
        'endtime', p.endtime,
        'save_status', p.save_status
      )
      ORDER BY p.pdate, p.endtime
    ) AS production_rows
    FROM "Production" p
    WHERE p.pcode = nd.pcode
      AND p.pdate BETWEEN p_from AND p_to
  ) period_prod ON TRUE
  WHERE
    CASE
      WHEN COALESCE(p_filter_by, 'deadline') IN ('production_date', 'completed_date') THEN
        COALESCE(period_prod.production_rows, '[]'::JSONB) <> '[]'::JSONB
      WHEN COALESCE(p_filter_by, 'deadline') = 'initialdate' THEN
        nd.initialdate_date BETWEEN p_from AND p_to
      ELSE
        nd.deadlinedate_ts >= p_from::TIMESTAMPTZ
        AND nd.deadlinedate_ts < (p_to + 1)::TIMESTAMPTZ
    END
  ORDER BY nd.deadlinedate_ts NULLS LAST, nd.pcode;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_fetch_progress_rows(DATE, DATE, TEXT, TEXT) TO authenticated;

-- Verify after applying:
-- SELECT * FROM public.rpc_fetch_progress_rows('2026-05-01', '2026-05-31', 'DMC1', 'deadline') LIMIT 5;
-- SELECT * FROM public.rpc_fetch_progress_rows('2026-05-01', '2026-05-31', NULL, 'production_date') LIMIT 5;
-- ============================================================
