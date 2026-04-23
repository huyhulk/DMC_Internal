-- ============================================================
-- 005: Report RPCs — thay 3 query JS bằng 1 query PostgreSQL
-- Performance: ~3–4 round-trips → 1 round-trip per report API call
--
-- Phụ thuộc: bảng "Production", data, "Norm" đã tồn tại (migration 001)
-- Áp dụng: supabase db push  hoặc  supabase migration up
-- ============================================================

-- ── Composite index (nếu chưa có) ────────────────────────────────────────
-- Tăng tốc query filter theo pcode + range pdate đồng thời.
CREATE INDEX IF NOT EXISTS idx_production_pcode_pdate
  ON "Production"(pcode, pdate);

-- ── fn_classify_shift: bản SQL của classifyShift() trong lib/shifts.ts ───
-- Logic PHẢI IDENTICAL với TypeScript. Kiểm tra bằng test so sánh output.
CREATE OR REPLACE FUNCTION fn_classify_shift(p_starttime TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_parts TEXT[];
  v_h     INTEGER;
  v_m     INTEGER;
  v_total INTEGER;
BEGIN
  IF p_starttime IS NULL OR trim(p_starttime) = '' THEN RETURN 'khac'; END IF;

  v_parts := regexp_split_to_array(trim(p_starttime), ':');
  BEGIN
    v_h := (v_parts[1])::INTEGER;
    v_m := (v_parts[2])::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'khac';
  END;

  IF v_h IS NULL OR v_m IS NULL THEN RETURN 'khac'; END IF;

  v_total := v_h * 60 + v_m;

  IF    v_total >= 450  AND v_total < 570  THEN RETURN 'ca_sang_1';   -- 07:30–09:30
  ELSIF v_total >= 570  AND v_total < 690  THEN RETURN 'ca_sang_2';   -- 09:30–11:30
  ELSIF v_total >= 750  AND v_total < 870  THEN RETURN 'ca_chieu_1';  -- 12:30–14:30
  ELSIF v_total >= 870  AND v_total < 990  THEN RETURN 'ca_chieu_2';  -- 14:30–16:30
  ELSE  RETURN 'khac';
  END IF;
END;
$$;

-- ── rpc_fetch_prod_rows: JOIN Production + data + Norm trong 1 query ─────
-- Thay thế 3 round-trips riêng lẻ trong _fetchProdRowsLegacy().
-- Cột "WORKSHOP" dùng quoted uppercase vì data table có UPPERCASE column names.
DROP FUNCTION IF EXISTS rpc_fetch_prod_rows(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION rpc_fetch_prod_rows(
  p_from          DATE,
  p_to            DATE,
  p_workshop_code TEXT    DEFAULT NULL   -- NULL = tất cả xưởng
)
RETURNS TABLE (
  pcode      TEXT,
  pdate      TEXT,
  workshop   TEXT,   -- DMC code đã chuẩn hóa: DMC1 / DMC3 / DMC4 / DMC5
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
    -- Chuẩn hóa WORKSHOP → DMC code một lần, dùng lại cho filter và JOIN Norm
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
        ELSE 'DMC1'
      END AS ws_code
    FROM data d
    WHERE
      p_workshop_code IS NULL
      OR (p_workshop_code = 'DMC1' AND (d."WORKSHOP" ILIKE 'Phân xưởng 1%' OR d."WORKSHOP" ILIKE 'Phân xưởng 2%' OR d."WORKSHOP" ILIKE 'DMC1%'))
      OR (p_workshop_code = 'DMC3' AND (d."WORKSHOP" ILIKE 'Phân xưởng 3%' OR d."WORKSHOP" ILIKE 'DMC3%'))
      OR (p_workshop_code = 'DMC4' AND (d."WORKSHOP" ILIKE 'Phân xưởng 4%' OR d."WORKSHOP" ILIKE 'DMC4%'))
      OR (p_workshop_code = 'DMC5' AND (d."WORKSHOP" ILIKE 'Phân xưởng 5%' OR d."WORKSHOP" ILIKE 'DMC5%'))
  )
  SELECT
    p.pcode::TEXT,
    p.pdate::TEXT,
    COALESCE(w.ws_code, 'DMC1')::TEXT        AS workshop,
    COALESCE(p.products, '')::TEXT            AS product,
    COALESCE(p.poutput,   0)::NUMERIC,
    COALESCE(p.eoutput,   0)::NUMERIC,
    COALESCE(p.routput,   0)::NUMERIC,
    COALESCE(p.workforce, 0)::NUMERIC,
    COALESCE(p.starttime, '')::TEXT,
    COALESCE(p.endtime,   '')::TEXT,
    COALESCE(p.realnorm,  0)::NUMERIC,
    COALESCE(n.norm,      0)::NUMERIC         AS norm,
    COALESCE(n.pspeed,    0)::NUMERIC         AS pspeed
  FROM "Production" p
  INNER JOIN ws_normalized w  ON w."PCODE" = p.pcode
  LEFT  JOIN "Norm"        n  ON n.products = p.products
                              AND n.workshop = w.ws_code
  WHERE p.pdate BETWEEN p_from AND p_to
  ORDER BY p.pdate;
$$;

-- ── Verify sau khi apply ──────────────────────────────────────────────────
-- SELECT * FROM rpc_fetch_prod_rows('2026-04-01', '2026-04-30') LIMIT 5;
-- SELECT * FROM rpc_fetch_prod_rows('2026-04-01', '2026-04-30', 'DMC4') LIMIT 5;
-- SELECT fn_classify_shift('07:30'); -- → ca_sang_1
-- SELECT fn_classify_shift('14:30'); -- → ca_chieu_2
-- SELECT fn_classify_shift(null);   -- → khac
-- ============================================================
