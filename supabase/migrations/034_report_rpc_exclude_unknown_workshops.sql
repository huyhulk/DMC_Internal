-- Keep report RPC workshop normalization aligned with app logic.
-- Unknown/empty workshops are excluded instead of being counted as DMC1.

CREATE OR REPLACE FUNCTION rpc_fetch_prod_rows(
  p_from          DATE,
  p_to            DATE,
  p_workshop_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  pcode      TEXT,
  pdate      TEXT,
  workshop   TEXT,
  product    TEXT,
  poutput    NUMERIC,
  eoutput    NUMERIC,
  routput    NUMERIC,
  workforce  NUMERIC,
  starttime  TEXT,
  endtime    TEXT,
  realnorm   NUMERIC,
  norm       NUMERIC,
  pspeed     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ws_normalized AS (
    SELECT
      d."PCODE",
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
        ELSE NULL
      END AS ws_code
    FROM data d
  )
  SELECT
    p.pcode::TEXT,
    p.pdate::TEXT,
    w.ws_code::TEXT                         AS workshop,
    COALESCE(p.products, '')::TEXT          AS product,
    COALESCE(p.poutput,   0)::NUMERIC,
    COALESCE(p.eoutput,   0)::NUMERIC,
    COALESCE(p.routput,   0)::NUMERIC,
    COALESCE(p.workforce, 0)::NUMERIC,
    COALESCE(p.starttime, '')::TEXT,
    COALESCE(p.endtime,   '')::TEXT,
    COALESCE(p.realnorm,  0)::NUMERIC,
    COALESCE(n.norm,      0)::NUMERIC       AS norm,
    COALESCE(n.pspeed,    0)::NUMERIC       AS pspeed
  FROM "Production" p
  INNER JOIN ws_normalized w ON w."PCODE" = p.pcode
                            AND w.ws_code IS NOT NULL
  LEFT JOIN "Norm" n ON n.products = p.products
                     AND n.workshop = w.ws_code
  WHERE p.pdate BETWEEN p_from AND p_to
    AND (p_workshop_code IS NULL OR w.ws_code = p_workshop_code)
  ORDER BY p.pdate;
$$;
