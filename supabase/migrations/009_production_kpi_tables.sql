-- SX-01: Lỗi thành phẩm
CREATE TABLE IF NOT EXISTS public.production_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  workshop TEXT NOT NULL,
  pcode TEXT,
  product_name TEXT,
  total_qty NUMERIC NOT NULL,
  defect_qty NUMERIC NOT NULL DEFAULT 0,
  defect_type TEXT,
  defect_cause TEXT,
  unit TEXT DEFAULT 'm',
  shift TEXT,
  reported_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defects_date_ws ON public.production_defects(report_date, workshop);

-- SX-02: Đơn hàng đúng tiến độ
CREATE TABLE IF NOT EXISTS public.order_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pcode TEXT NOT NULL,
  workshop TEXT NOT NULL,
  customer TEXT,
  planned_date DATE NOT NULL,
  actual_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (actual_date IS NOT NULL AND actual_date <= planned_date) STORED,
  delay_days INTEGER GENERATED ALWAYS AS (
    CASE WHEN actual_date IS NULL THEN NULL
         ELSE GREATEST(0, (actual_date - planned_date)) END
  ) STORED,
  delay_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','delayed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_completion_pcode ON public.order_completion(pcode);
CREATE INDEX IF NOT EXISTS idx_order_completion_date ON public.order_completion(planned_date, workshop);

-- SX-04: Tiêu hao NVL
CREATE TABLE IF NOT EXISTS public.material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  workshop TEXT NOT NULL,
  pcode TEXT,
  material_code TEXT NOT NULL,
  material_name TEXT,
  norm_qty NUMERIC NOT NULL,
  actual_qty NUMERIC NOT NULL,
  variance_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN norm_qty = 0 THEN 0 ELSE (actual_qty - norm_qty) / norm_qty * 100 END
  ) STORED,
  unit TEXT DEFAULT 'kg',
  cost_per_unit NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_usage_date ON public.material_usage(report_date, workshop);

-- SX-05/KH-04: 5S Findings
CREATE TABLE IF NOT EXISTS public.findings_5s (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_date DATE NOT NULL,
  workshop TEXT NOT NULL,
  department TEXT CHECK (department IN ('PRODUCTION','COORDINATION','MAINTENANCE','ALL')),
  area TEXT,
  category TEXT CHECK (category IN ('Sàng lọc','Sắp xếp','Sạch sẽ','Săn sóc','Sẵn sàng')),
  description TEXT NOT NULL,
  photo_url TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  due_date DATE NOT NULL,
  resolved_date DATE,
  is_resolved BOOLEAN GENERATED ALWAYS AS (resolved_date IS NOT NULL) STORED,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    resolved_date IS NOT NULL AND resolved_date <= due_date
  ) STORED,
  responsible_person TEXT,
  resolution_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_5s_date_ws ON public.findings_5s(finding_date, workshop);

-- SX-06: Tiến độ thi công công trình
CREATE TABLE IF NOT EXISTS public.site_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  customer TEXT,
  start_date DATE NOT NULL,
  planned_end_date DATE NOT NULL,
  actual_end_date DATE,
  planned_hours NUMERIC NOT NULL,
  actual_hours NUMERIC,
  progress_pct NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('planned','in_progress','completed','delayed','cancelled')),
  delay_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_progress_status ON public.site_progress(status, start_date);

-- RLS
ALTER TABLE public.production_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings_5s ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_progress ENABLE ROW LEVEL SECURITY;

-- production_defects policies
CREATE POLICY "defects_select" ON public.production_defects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "defects_insert" ON public.production_defects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "defects_update_admin" ON public.production_defects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "defects_delete_admin" ON public.production_defects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- order_completion policies
CREATE POLICY "order_completion_select" ON public.order_completion FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "order_completion_insert" ON public.order_completion FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "order_completion_update_admin" ON public.order_completion FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "order_completion_delete_admin" ON public.order_completion FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- material_usage policies
CREATE POLICY "material_usage_select" ON public.material_usage FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "material_usage_insert" ON public.material_usage FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "material_usage_update_admin" ON public.material_usage FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "material_usage_delete_admin" ON public.material_usage FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- findings_5s policies
CREATE POLICY "findings_5s_select" ON public.findings_5s FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "findings_5s_insert" ON public.findings_5s FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "findings_5s_update_admin" ON public.findings_5s FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "findings_5s_delete_admin" ON public.findings_5s FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- site_progress policies
CREATE POLICY "site_progress_select" ON public.site_progress FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "site_progress_insert" ON public.site_progress FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "site_progress_update_admin" ON public.site_progress FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "site_progress_delete_admin" ON public.site_progress FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
