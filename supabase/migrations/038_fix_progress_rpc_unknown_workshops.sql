-- ============================================================
-- 038: Exclude unknown workshops from progress report RPC
-- Keeps rpc_fetch_progress_rows aligned with shared report
-- workshop normalization: only DMC1/DMC3/DMC4/DMC5 are reportable.
-- ============================================================

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
  WITH profile_scope AS (
    SELECT
      p.role::TEXT AS role,
      COALESCE(p.workspace, '')::TEXT AS workspace
    FROM profiles p
    WHERE p.id = auth.uid()
  ), access_scope AS (
    SELECT
      auth.role() = 'service_role'
        OR ps.role = 'ADMIN'
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(ps.workspace, ',') token
          WHERE upper(trim(token)) = 'ALL'
        ) AS unrestricted,
      ARRAY(
        SELECT DISTINCT CASE
          WHEN upper(trim(token)) IN ('DMC1', 'DM1', 'DM2') THEN 'DMC1'
          WHEN upper(trim(token)) IN ('DMC3', 'DM3') THEN 'DMC3'
          WHEN upper(trim(token)) IN ('DMC4', 'DM4') THEN 'DMC4'
          WHEN upper(trim(token)) IN ('DMC5', 'DM5') THEN 'DMC5'
          ELSE NULL
        END
        FROM regexp_split_to_table(ps.workspace, ',') token
      ) AS workshops
    FROM profile_scope ps
    UNION ALL
    SELECT TRUE, ARRAY[]::TEXT[]
    WHERE auth.role() = 'service_role'
  ), normalized_data AS (
    SELECT
      d."PCODE"::TEXT AS pcode,
      CASE
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 1%' THEN 'DMC1'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 2%' THEN 'DMC1'
        WHEN d."WORKSHOP" ILIKE 'DMC1%'          THEN 'DMC1'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 3%' THEN 'DMC3'
        WHEN d."WORKSHOP" ILIKE 'DMC3%'          THEN 'DMC3'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 4%' THEN 'DMC4'
        WHEN d."WORKSHOP" ILIKE 'DMC4%'          THEN 'DMC4'
        WHEN d."WORKSHOP" ILIKE 'Phân xưởng 5%' THEN 'DMC5'
        WHEN d."WORKSHOP" ILIKE 'DMC5%'          THEN 'DMC5'
        ELSE NULL
      END AS workshop,
      COALESCE(d."DESCRIPTION", '')::TEXT AS description,
      COALESCE(d."CUSTOMER", '')::TEXT AS customer,
      COALESCE(d."QUANTITY", 0)::NUMERIC AS quantity,
      d."INITIALDATE" AS initialdate_date,
      d."DEADLINEDATE" AS deadlinedate_ts,
      COALESCE(d."STATUS", '')::TEXT AS source_status
    FROM data d
    WHERE d."PCODE" IS NOT NULL
  )
  SELECT
    nd.pcode,
    nd.workshop,
    nd.description,
    nd.customer,
    nd.quantity,
    COALESCE(nd.initialdate_date::TEXT, '') AS initialdate,
    COALESCE(to_char(nd.deadlinedate_ts, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS deadlinedate,
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
  WHERE nd.workshop IS NOT NULL
    AND (p_workshop_code IS NULL OR nd.workshop = p_workshop_code)
    AND CASE
      WHEN COALESCE(p_filter_by, 'deadline') IN ('production_date', 'completed_date') THEN
        COALESCE(period_prod.production_rows, '[]'::JSONB) <> '[]'::JSONB
      WHEN COALESCE(p_filter_by, 'deadline') = 'initialdate' THEN
        nd.initialdate_date BETWEEN p_from AND p_to
      ELSE
        nd.deadlinedate_ts >= p_from::TIMESTAMP
        AND nd.deadlinedate_ts < (p_to + 1)::TIMESTAMP
    END
    AND EXISTS (
      SELECT 1
      FROM access_scope s
      WHERE s.unrestricted
        OR nd.workshop = ANY(s.workshops)
    )
  ORDER BY nd.deadlinedate_ts NULLS LAST, nd.pcode;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_fetch_progress_rows(DATE, DATE, TEXT, TEXT) TO authenticated;

-- Verify after applying to staging:
-- SELECT pcode, workshop, deadlinedate
-- FROM public.rpc_fetch_progress_rows('2026-03-01', '2026-03-31', 'DMC1', 'deadline')
-- WHERE pcode = 'LSX03/26-00762';
-- Expected: 0 rows; this source order has raw WORKSHOP = 'Hoạt động thi công tại công trình'.
--
-- SELECT "PCODE", "DEADLINEDATE"
-- FROM data
-- WHERE "PCODE" = 'LSX03/26-00762';
-- Confirm stored local timestamp is preserved by any returned report rows for dated checks.
-- ============================================================
