-- KT-01/02/03: Sự cố máy (downtime)
CREATE TABLE IF NOT EXISTS public.machine_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop TEXT NOT NULL,
  machine_code TEXT NOT NULL,
  machine_name TEXT,
  breakdown_start TIMESTAMPTZ NOT NULL,
  breakdown_end TIMESTAMPTZ,
  downtime_minutes NUMERIC GENERATED ALWAYS AS (
    CASE WHEN breakdown_end IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (breakdown_end - breakdown_start))/60 END
  ) STORED,
  failure_type TEXT,
  root_cause TEXT,
  is_planned BOOLEAN DEFAULT false,
  repair_action TEXT,
  parts_replaced TEXT,
  technician TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breakdowns_machine ON public.machine_breakdowns(machine_code, breakdown_start);
CREATE INDEX IF NOT EXISTS idx_breakdowns_ws ON public.machine_breakdowns(workshop, breakdown_start);

-- KT-04: Lịch bảo trì
CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop TEXT NOT NULL,
  machine_code TEXT NOT NULL,
  machine_name TEXT,
  maintenance_type TEXT CHECK (maintenance_type IN ('daily','weekly','monthly','quarterly','annually')),
  scheduled_date DATE NOT NULL,
  actual_date DATE,
  is_completed BOOLEAN GENERATED ALWAYS AS (actual_date IS NOT NULL) STORED,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    actual_date IS NOT NULL AND actual_date <= scheduled_date
  ) STORED,
  checklist_items JSONB,
  technician TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_sched_date ON public.maintenance_schedule(scheduled_date, workshop);

-- KT-05/06: Bản vẽ kỹ thuật
CREATE TABLE IF NOT EXISTS public.technical_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_code TEXT NOT NULL UNIQUE,
  drawing_name TEXT NOT NULL,
  customer TEXT,
  project_code TEXT,
  request_date DATE NOT NULL,
  due_date DATE NOT NULL,
  delivered_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    delivered_date IS NOT NULL AND delivered_date <= due_date
  ) STORED,
  has_errors BOOLEAN DEFAULT false,
  error_count INTEGER DEFAULT 0,
  error_details TEXT,
  reviewer TEXT,
  drafter TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','reviewing','approved','revised','released')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drawings_due ON public.technical_drawings(due_date);

-- KT-07: Khảo sát công trình
CREATE TABLE IF NOT EXISTS public.site_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_code TEXT NOT NULL,
  project_code TEXT,
  customer TEXT,
  survey_date DATE NOT NULL,
  surveyor TEXT,
  total_items INTEGER NOT NULL,
  error_items INTEGER DEFAULT 0,
  accuracy_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_items = 0 THEN 0
         ELSE (total_items - error_items)::NUMERIC / total_items * 100 END
  ) STORED,
  error_details JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_date ON public.site_surveys(survey_date);

-- RLS
ALTER TABLE public.machine_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_surveys ENABLE ROW LEVEL SECURITY;

-- machine_breakdowns policies
CREATE POLICY "breakdowns_select" ON public.machine_breakdowns FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "breakdowns_insert" ON public.machine_breakdowns FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "breakdowns_update_admin" ON public.machine_breakdowns FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "breakdowns_delete_admin" ON public.machine_breakdowns FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- maintenance_schedule policies
CREATE POLICY "maint_sched_select" ON public.maintenance_schedule FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "maint_sched_insert" ON public.maintenance_schedule FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "maint_sched_update_admin" ON public.maintenance_schedule FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "maint_sched_delete_admin" ON public.maintenance_schedule FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- technical_drawings policies
CREATE POLICY "drawings_select" ON public.technical_drawings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "drawings_insert" ON public.technical_drawings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "drawings_update_admin" ON public.technical_drawings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "drawings_delete_admin" ON public.technical_drawings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- site_surveys policies
CREATE POLICY "surveys_select" ON public.site_surveys FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "surveys_insert" ON public.site_surveys FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "surveys_update_admin" ON public.site_surveys FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "surveys_delete_admin" ON public.site_surveys FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
