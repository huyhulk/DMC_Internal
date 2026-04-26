-- ============================================================
-- STAGING INIT — DMC Production Manager
-- Source of truth: .claude/database-schema.md (snapshot 2026-04-23)
-- KHÔNG chạy trên production. Chỉ dành cho staging DB.
--
-- Tại sao không dùng migration 001–006:
--   migration 001 tạo "DATA" (uppercase) + lowercase columns,
--   nhưng production thực tế dùng data (lowercase) + "PCODE" uppercase.
--   File này phản ánh schema production thực tế.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT        UNIQUE NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'USER'
                         CHECK (role IN ('ADMIN','MANAGER','SUPERVISOR','USER')),
  workspace  TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- data (lowercase table, UPPERCASE columns — match production)
CREATE TABLE IF NOT EXISTS data (
  id             BIGSERIAL    PRIMARY KEY,
  "PCODE"        TEXT         UNIQUE NOT NULL,
  "INITIALDATE"  DATE,
  "CUSTOMER"     TEXT,
  "WORKSHOP"     TEXT,
  "DESCRIPTION"  TEXT,
  "QUANTITY"     NUMERIC,
  "DEADLINEDATE" TIMESTAMPTZ,
  "STATUS"       TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ
);

-- "Norm" (PascalCase quoted, lowercase columns)
CREATE TABLE IF NOT EXISTS "Norm" (
  id         BIGSERIAL   PRIMARY KEY,
  products   TEXT        NOT NULL,
  norm       NUMERIC     DEFAULT 0,
  nwforce    NUMERIC     DEFAULT 0,
  workshop   TEXT,
  pspeed     NUMERIC     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- "Material"
CREATE TABLE IF NOT EXISTS "Material" (
  id         BIGSERIAL   PRIMARY KEY,
  product    TEXT        NOT NULL,
  material   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- "Production"
CREATE TABLE IF NOT EXISTS "Production" (
  id         BIGSERIAL   PRIMARY KEY,
  pdate      DATE,
  totalem    TEXT        DEFAULT '',
  pcode      TEXT,
  products   TEXT,
  material   TEXT        DEFAULT '',
  poutput    NUMERIC     DEFAULT 0,
  eoutput    NUMERIC     DEFAULT 0,
  routput    NUMERIC     DEFAULT 0,
  workforce  NUMERIC     DEFAULT 0,
  starttime  TEXT        DEFAULT '',
  endtime    TEXT        DEFAULT '',
  realnorm   NUMERIC     DEFAULT 0,
  log        TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_pcode
  ON data("PCODE");

CREATE INDEX IF NOT EXISTS idx_data_initialdate
  ON data("INITIALDATE");

CREATE INDEX IF NOT EXISTS idx_data_workshop
  ON data("WORKSHOP");

CREATE INDEX IF NOT EXISTS idx_norm_products
  ON "Norm"(products);

CREATE INDEX IF NOT EXISTS idx_norm_workshop
  ON "Norm"(workshop);

CREATE INDEX IF NOT EXISTS idx_material_product
  ON "Material"(product);

CREATE INDEX IF NOT EXISTS idx_production_pdate
  ON "Production"(pdate);

CREATE INDEX IF NOT EXISTS idx_production_pcode
  ON "Production"(pcode);

-- Composite từ migration 005
CREATE INDEX IF NOT EXISTS idx_production_pcode_pdate
  ON "Production"(pcode, pdate);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE data        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Norm"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Production" ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- data
CREATE POLICY "data_select_authenticated" ON data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "data_insert_authenticated" ON data
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "data_update_authenticated" ON data
  FOR UPDATE TO authenticated USING (true);

-- "Norm"
CREATE POLICY "norm_select_authenticated" ON "Norm"
  FOR SELECT TO authenticated USING (true);

-- "Material"
CREATE POLICY "material_select_authenticated" ON "Material"
  FOR SELECT TO authenticated USING (true);

-- "Production" — SELECT
CREATE POLICY "production_select_authenticated" ON "Production"
  FOR SELECT TO authenticated USING (true);

-- "Production" — INSERT (via RLS helper, từ migration 004)
-- Policy tạo sau khi function check_production_insert_permission tồn tại

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: tạo profiles row khi user mới sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, workspace)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER'),
    COALESCE(NEW.raw_user_meta_data->>'workspace', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS helper: kiểm tra user có quyền insert Production cho workshop này
-- Logic từ migration 004 (final version)
CREATE OR REPLACE FUNCTION check_production_insert_permission(p_pcode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      TEXT;
  v_workspace TEXT;
  v_workshop  TEXT;
BEGIN
  SELECT role, workspace
  INTO v_role, v_workspace
  FROM profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  IF v_role = 'ADMIN' THEN RETURN TRUE; END IF;

  IF upper(v_workspace) = 'ALL' THEN RETURN TRUE; END IF;

  IF v_workspace IS NULL OR v_workspace = '' THEN RETURN FALSE; END IF;

  SELECT "WORKSHOP" INTO v_workshop FROM data WHERE "PCODE" = p_pcode LIMIT 1;
  IF v_workshop IS NULL THEN RETURN TRUE; END IF;

  RETURN (
    ((v_workshop ILIKE 'Phân xưởng 1%' OR v_workshop ILIKE 'Phân xưởng 2%' OR v_workshop = 'DMC1')
      AND v_workspace ILIKE '%DMC1%')
    OR ((v_workshop ILIKE 'Phân xưởng 3%' OR v_workshop = 'DMC3')
      AND v_workspace ILIKE '%DMC3%')
    OR ((v_workshop ILIKE 'Phân xưởng 4%' OR v_workshop = 'DMC4')
      AND v_workspace ILIKE '%DMC4%')
    OR ((v_workshop ILIKE 'Phân xưởng 5%' OR v_workshop = 'DMC5')
      AND v_workspace ILIKE '%DMC5%')
  );
END;
$$;

-- fn_classify_shift — phiên bản cuối từ migration 006
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

  IF    v_total >= 450  AND v_total < 570  THEN RETURN 'ca_sang_1';
  ELSIF v_total >= 570  AND v_total < 690  THEN RETURN 'ca_sang_2';
  ELSIF v_total >= 750  AND v_total < 870  THEN RETURN 'ca_chieu_1';
  ELSIF v_total >= 870  AND v_total < 990  THEN RETURN 'ca_chieu_2';
  ELSIF v_total >= 990  AND v_total < 1320 THEN RETURN 'ca_tang_ca';
  ELSE  RETURN 'khac';
  END IF;
END;
$$;

-- rpc_fetch_prod_rows — từ migration 005
DROP FUNCTION IF EXISTS rpc_fetch_prod_rows(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION rpc_fetch_prod_rows(
  p_from          DATE,
  p_to            DATE,
  p_workshop_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  pcode     TEXT,
  pdate     TEXT,
  workshop  TEXT,
  product   TEXT,
  poutput   NUMERIC,
  eoutput   NUMERIC,
  routput   NUMERIC,
  workforce NUMERIC,
  starttime TEXT,
  endtime   TEXT,
  realnorm  NUMERIC,
  norm      NUMERIC,
  pspeed    NUMERIC
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
    COALESCE(w.ws_code, 'DMC1')::TEXT       AS workshop,
    COALESCE(p.products, '')::TEXT           AS product,
    COALESCE(p.poutput,   0)::NUMERIC,
    COALESCE(p.eoutput,   0)::NUMERIC,
    COALESCE(p.routput,   0)::NUMERIC,
    COALESCE(p.workforce, 0)::NUMERIC,
    COALESCE(p.starttime, '')::TEXT,
    COALESCE(p.endtime,   '')::TEXT,
    COALESCE(p.realnorm,  0)::NUMERIC,
    COALESCE(n.norm,      0)::NUMERIC        AS norm,
    COALESCE(n.pspeed,    0)::NUMERIC        AS pspeed
  FROM "Production" p
  INNER JOIN ws_normalized w ON w."PCODE" = p.pcode
  LEFT  JOIN "Norm"        n ON n.products = p.products
                             AND n.workshop = w.ws_code
  WHERE p.pdate BETWEEN p_from AND p_to
  ORDER BY p.pdate;
$$;

-- ============================================================
-- INSERT POLICY (sau khi function đã tồn tại)
-- ============================================================

CREATE POLICY "production_insert_workshop_allowed" ON "Production"
  FOR INSERT TO authenticated
  WITH CHECK (check_production_insert_permission(pcode));

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_data_updated_at
  BEFORE UPDATE ON data
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE "Production";
