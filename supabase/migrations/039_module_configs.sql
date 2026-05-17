-- supabase/migrations/039_module_configs.sql

-- ═══════════════════════════════════════════════
-- MODULE_CONFIGS: cấu hình từng module top-level
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.module_configs (
  module_key    TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES auth.users(id)
);

ALTER TABLE public.module_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_configs_select_authenticated"
  ON public.module_configs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "module_configs_all_admin"
  ON public.module_configs FOR ALL
  TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE TRIGGER handle_module_configs_updated_at
  BEFORE UPDATE ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═════════════════════════════════════════════════════
-- MODULE_SUBTAB_CONFIGS: cấu hình từng sub-tab theo module
-- ═════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.module_subtab_configs (
  module_key    TEXT NOT NULL REFERENCES public.module_configs(module_key) ON DELETE CASCADE,
  subtab_key    TEXT NOT NULL,
  label         TEXT NOT NULL,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (module_key, subtab_key)
);

ALTER TABLE public.module_subtab_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_subtab_configs_select_authenticated"
  ON public.module_subtab_configs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "module_subtab_configs_all_admin"
  ON public.module_subtab_configs FOR ALL
  TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ═══════════════════════════════════════════════
-- SEED DATA — khớp với hardcode hiện tại trong code
-- ═══════════════════════════════════════════════
INSERT INTO public.module_configs (module_key, label, display_order) VALUES
  ('production',     'Sản Xuất',  1),
  ('maintenance',    'Bảo Trì',   2),
  ('coordination',   'Điều Phối', 3),
  ('administration', 'HC-NS',     4),
  ('report',         'Báo Cáo',   5),
  ('admin',          'Hệ Thống',  6)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO public.module_subtab_configs (module_key, subtab_key, label, display_order) VALUES
  ('maintenance', 'breakdowns', 'Sự Cố Máy',           1),
  ('maintenance', 'schedule',   'Lịch Bảo Trì',         2),
  ('maintenance', 'drawings',   'Bản Vẽ KT',            3),
  ('maintenance', 'surveys',    'Khảo Sát',             4),
  ('maintenance', 'machines',   'Thiết Bị',             5),
  ('coordination', 'delivery',   'Giao Hàng',           1),
  ('coordination', 'findings5s', 'Kho nguyên phụ liệu', 2),
  ('coordination', 'reports',    'Báo Cáo TK',          3),
  ('administration', 'overtime',       'Tăng ca',        1),
  ('administration', 'hr',             'Nhân sự',        2),
  ('administration', 'hr-performance', 'Hiệu suất NS',   3),
  ('administration', 'findings5s',     '5S',             4),
  ('administration', 'iso',            'Quy trình ISO',  5)
ON CONFLICT (module_key, subtab_key) DO NOTHING;
