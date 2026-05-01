-- 018_human_resource.sql
-- Bảng nhân sự (HR admin) và dữ liệu điểm danh hàng ngày

-- ─── human_resource ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.human_resource (
  id         SERIAL PRIMARY KEY,
  name       TEXT   NOT NULL,
  factory    TEXT,
  machine    TEXT,
  position   TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_factory ON public.human_resource (factory);
CREATE INDEX IF NOT EXISTS idx_hr_name    ON public.human_resource (name);

ALTER TABLE public.human_resource ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_select_authenticated" ON public.human_resource
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hr_insert_admin" ON public.human_resource
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER'))
  );

CREATE POLICY "hr_update_admin" ON public.human_resource
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "hr_delete_admin" ON public.human_resource
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- ─── hr_daily ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_daily (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  factory    TEXT  NOT NULL,
  pdate      DATE  NOT NULL,
  totalem    INTEGER NOT NULL DEFAULT 0,
  absent_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (factory, pdate)
);

CREATE INDEX IF NOT EXISTS idx_hr_daily_factory_date ON public.hr_daily (factory, pdate DESC);

ALTER TABLE public.hr_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_daily_select" ON public.hr_daily
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hr_daily_upsert_admin" ON public.hr_daily
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
