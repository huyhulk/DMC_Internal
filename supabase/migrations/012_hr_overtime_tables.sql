-- Helper function: chuẩn hóa workshop từ tên file CSV về DB chuẩn
CREATE OR REPLACE FUNCTION public.normalize_workshop(p_raw TEXT)
RETURNS TEXT AS $$
  SELECT UPPER(TRIM(
    CASE UPPER(TRIM(p_raw))
      WHEN 'DM1'    THEN 'DMC1'
      WHEN 'DM2'    THEN 'DMC1'
      WHEN 'DM3'    THEN 'DMC3'
      WHEN 'DM4'    THEN 'DMC4'
      WHEN 'DM5'    THEN 'DMC5'
      WHEN 'DMC1'   THEN 'DMC1'
      WHEN 'DMC3'   THEN 'DMC3'
      WHEN 'DMC4'   THEN 'DMC4'
      WHEN 'DMC5'   THEN 'DMC5'
      WHEN 'PKT-SX' THEN 'PKT-SX'
      WHEN 'PKT_SX' THEN 'PKT-SX'
      ELSE p_raw
    END
  ));
$$ LANGUAGE sql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.normalize_workshop TO authenticated;

-- Bảng nhân viên
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  workshop TEXT,
  position TEXT,
  team TEXT,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_ws ON public.employees(workshop, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(full_name);

-- Bảng tăng ca (master record)
CREATE TABLE IF NOT EXISTS public.overtime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_date DATE NOT NULL,
  customer TEXT,
  pcode TEXT,
  workshop TEXT NOT NULL,
  original_workshop TEXT,
  ot_category TEXT NOT NULL CHECK (ot_category IN ('PRODUCTION','DELIVERY','INTERNAL')),
  reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_employees INTEGER NOT NULL,
  total_hours NUMERIC NOT NULL,
  required_output NUMERIC,
  planned_hours NUMERIC,
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','csv_import','google_sheet')),
  source_ref TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_date_ws ON public.overtime_records(ot_date, workshop);
CREATE INDEX IF NOT EXISTS idx_ot_pcode ON public.overtime_records(pcode);
CREATE INDEX IF NOT EXISTS idx_ot_orig_ws ON public.overtime_records(original_workshop);

-- Trigger: auto-normalize workshop khi insert/update
CREATE OR REPLACE FUNCTION public.trg_normalize_ot_workshop()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.original_workshop IS NULL THEN
    NEW.original_workshop := NEW.workshop;
  END IF;
  NEW.workshop := public.normalize_workshop(NEW.workshop);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_ot_workshop_biu
  BEFORE INSERT OR UPDATE OF workshop ON public.overtime_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_ot_workshop();

-- Bảng quan hệ N-N: nhân viên tham gia tăng ca
CREATE TABLE IF NOT EXISTS public.overtime_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_id UUID NOT NULL REFERENCES public.overtime_records(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  employee_name TEXT NOT NULL,
  hours NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(overtime_id, employee_name)
);

CREATE INDEX IF NOT EXISTS idx_ot_part_emp ON public.overtime_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_part_name ON public.overtime_participants(employee_name);

-- Bảng cấu hình import
CREATE TABLE IF NOT EXISTS public.overtime_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT,
  sheet_name TEXT,
  import_month TEXT,
  rows_imported INTEGER,
  rows_skipped INTEGER,
  errors JSONB,
  status TEXT CHECK (status IN ('pending','running','success','failed','partial')),
  imported_by UUID REFERENCES public.profiles(id),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_all" ON public.employees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "employees_modify_admin" ON public.employees FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "ot_select_all" ON public.overtime_records FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ot_insert" ON public.overtime_records FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ot_update_admin" ON public.overtime_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "ot_delete_admin" ON public.overtime_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "ot_part_select_all" ON public.overtime_participants FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ot_part_modify" ON public.overtime_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "ot_imports_select" ON public.overtime_imports FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ot_imports_modify_admin" ON public.overtime_imports FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));
