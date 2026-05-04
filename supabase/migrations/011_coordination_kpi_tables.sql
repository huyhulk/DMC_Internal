-- KH-02/03/07: Giao hàng
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_code TEXT NOT NULL UNIQUE,
  pcode TEXT,
  customer TEXT NOT NULL,
  delivery_address TEXT,
  planned_date DATE NOT NULL,
  actual_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    actual_date IS NOT NULL AND actual_date <= planned_date
  ) STORED,
  total_weight_tons NUMERIC NOT NULL,
  damaged_weight_tons NUMERIC DEFAULT 0,
  damage_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_weight_tons = 0 THEN 0
         ELSE damaged_weight_tons / total_weight_tons * 100 END
  ) STORED,
  damage_reason TEXT,
  vehicle_code TEXT,
  driver TEXT,
  delivery_cost NUMERIC,
  cost_per_ton NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_weight_tons = 0 THEN 0
         ELSE delivery_cost / total_weight_tons END
  ) STORED,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','in_transit','delivered','damaged','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_date ON public.deliveries(planned_date);

-- Bảng baseline chi phí 2025 (dùng cho KH-03)
CREATE TABLE IF NOT EXISTS public.delivery_cost_baseline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER,
  avg_cost_per_ton NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

INSERT INTO public.delivery_cost_baseline (year, month, avg_cost_per_ton) VALUES
  (2025, NULL, 0)
ON CONFLICT DO NOTHING;

-- KH-05: Báo cáo thống kê
CREATE TABLE IF NOT EXISTS public.statistical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  report_type TEXT,
  due_date DATE NOT NULL,
  submitted_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    submitted_date IS NOT NULL AND submitted_date <= due_date
  ) STORED,
  recipient TEXT,
  responsible_person TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stat_reports_due ON public.statistical_reports(due_date);

-- KH-06: Quy trình ISO
CREATE TABLE IF NOT EXISTS public.iso_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_code TEXT NOT NULL UNIQUE,
  procedure_name TEXT NOT NULL,
  category TEXT,
  planned_completion_date DATE NOT NULL,
  actual_completion_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    actual_completion_date IS NOT NULL AND actual_completion_date <= planned_completion_date
  ) STORED,
  progress_pct NUMERIC DEFAULT 0,
  responsible_person TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','reviewing','approved','released','revised')),
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iso_status ON public.iso_procedures(status, planned_completion_date);

-- RLS
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cost_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iso_procedures ENABLE ROW LEVEL SECURITY;

-- deliveries policies
CREATE POLICY "deliveries_select" ON public.deliveries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "deliveries_insert" ON public.deliveries FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "deliveries_update_admin" ON public.deliveries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "deliveries_delete_admin" ON public.deliveries FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- delivery_cost_baseline policies
CREATE POLICY "dcb_select" ON public.delivery_cost_baseline FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "dcb_modify_admin" ON public.delivery_cost_baseline FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- statistical_reports policies
CREATE POLICY "stat_reports_select" ON public.statistical_reports FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "stat_reports_insert" ON public.statistical_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "stat_reports_update_admin" ON public.statistical_reports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "stat_reports_delete_admin" ON public.statistical_reports FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- iso_procedures policies
CREATE POLICY "iso_select" ON public.iso_procedures FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "iso_insert" ON public.iso_procedures FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "iso_update_admin" ON public.iso_procedures FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "iso_delete_admin" ON public.iso_procedures FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
