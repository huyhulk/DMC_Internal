-- ============================================================
-- DMC Production Manager - Initial Schema
-- Cấu trúc table giữ nguyên tên Google Sheet
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN','MANAGER','SUPERVISOR','USER')),
  workspace TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DATA (Đơn hàng / Orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS "DATA" (
  id BIGSERIAL PRIMARY KEY,
  pcode TEXT NOT NULL,
  initialdate DATE,
  workshop TEXT,
  customer TEXT,
  quantity TEXT,
  description TEXT,
  deadlinedate DATE,
  deadlinetime TEXT,
  status TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_pcode ON "DATA"(pcode);
CREATE INDEX IF NOT EXISTS idx_data_initialdate ON "DATA"(initialdate);
CREATE INDEX IF NOT EXISTS idx_data_workshop ON "DATA"(workshop);

-- ============================================================
-- Norm (Định mức sản xuất)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Norm" (
  id BIGSERIAL PRIMARY KEY,
  products TEXT NOT NULL,
  norm NUMERIC DEFAULT 0,
  nwforce NUMERIC DEFAULT 0,
  workshop TEXT,
  pspeed NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_norm_products ON "Norm"(products);
CREATE INDEX IF NOT EXISTS idx_norm_workshop ON "Norm"(workshop);

-- ============================================================
-- Material (Vật tư theo sản phẩm)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Material" (
  id BIGSERIAL PRIMARY KEY,
  product TEXT NOT NULL,
  material TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_product ON "Material"(product);

-- ============================================================
-- Production (Dữ liệu sản xuất ghi nhận hàng ngày)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Production" (
  id BIGSERIAL PRIMARY KEY,
  pdate DATE,
  totalem TEXT DEFAULT '',
  pcode TEXT,
  products TEXT,
  material TEXT DEFAULT '',
  poutput NUMERIC DEFAULT 0,
  eoutput NUMERIC DEFAULT 0,
  routput NUMERIC DEFAULT 0,
  workforce NUMERIC DEFAULT 0,
  starttime TEXT DEFAULT '',
  endtime TEXT DEFAULT '',
  realnorm NUMERIC DEFAULT 0,
  log TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_pdate ON "Production"(pdate);
CREATE INDEX IF NOT EXISTS idx_production_pcode ON "Production"(pcode);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DATA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Norm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Production" ENABLE ROW LEVEL SECURITY;

-- profiles: user chỉ đọc được profile của mình; ADMIN đọc tất cả
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- DATA: authenticated users can read
CREATE POLICY "data_select_authenticated" ON "DATA"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "data_insert_authenticated" ON "DATA"
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "data_update_authenticated" ON "DATA"
  FOR UPDATE TO authenticated USING (true);

-- Norm: authenticated users can read
CREATE POLICY "norm_select_authenticated" ON "Norm"
  FOR SELECT TO authenticated USING (true);

-- Material: authenticated users can read
CREATE POLICY "material_select_authenticated" ON "Material"
  FOR SELECT TO authenticated USING (true);

-- Production: authenticated users can read and insert
CREATE POLICY "production_select_authenticated" ON "Production"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_insert_authenticated" ON "Production"
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_data_updated_at
  BEFORE UPDATE ON "DATA"
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- FUNCTION: Create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, role, workspace)
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- REALTIME (enable for Production table)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE "Production";
