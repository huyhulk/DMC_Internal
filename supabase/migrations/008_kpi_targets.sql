CREATE TABLE IF NOT EXISTS public.kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_code TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL CHECK (department IN ('PRODUCTION','MAINTENANCE','COORDINATION')),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  target_operator TEXT NOT NULL CHECK (target_operator IN ('lte','gte','lt','gt','eq')),
  default_period TEXT NOT NULL CHECK (default_period IN ('weekly','monthly','quarterly','yearly')),
  target_weekly NUMERIC,
  target_monthly NUMERIC,
  target_quarterly NUMERIC,
  target_yearly NUMERIC,
  formula TEXT,
  action_plan TEXT,
  is_active BOOLEAN DEFAULT true,
  year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.kpi_targets (kpi_code, department, name, unit, target_value, target_operator, default_period, formula) VALUES
  ('SX-01','PRODUCTION','Tỷ lệ lỗi thành phẩm','%',0.1,'lte','quarterly','Σ KL lỗi / Σ KL sản xuất'),
  ('SX-02','PRODUCTION','Đúng tiến độ đơn hàng','%',99.5,'gte','quarterly','SL đơn hoàn thành / Tổng SL đơn'),
  ('SX-03','PRODUCTION','Hiệu suất sản xuất (OEE)','%',90,'gte','monthly','OEE = A × P × Q'),
  ('SX-04','PRODUCTION','Chi phí NVL trong định mức','%',99.5,'gte','quarterly','Tiêu hao thực / Tiêu hao định mức'),
  ('SX-05','PRODUCTION','Tỷ lệ hoàn thành 5S','%',90,'gte','monthly','Hình 5S khắc phục đúng hạn / Tổng hình phát hiện'),
  ('SX-06','PRODUCTION','Tiến độ thi công công trình','%',95,'gte','monthly','Σ thời gian KH / Σ thời gian thực tế'),
  ('KT-01','MAINTENANCE','Thời gian dừng máy ngoài KH','h/ngày',4,'lt','monthly','Σ thời gian dừng / số ngày'),
  ('KT-02','MAINTENANCE','Thời gian sửa chữa TB (MTTR)','phút/lần',60,'lte','monthly','Σ thời gian sửa / Σ số lần hỏng'),
  ('KT-03','MAINTENANCE','Thời gian giữa 2 lỗi (MTBF)','giờ',160,'gte','quarterly','Σ thời gian hoạt động / Σ số lần hỏng'),
  ('KT-04','MAINTENANCE','Tỷ lệ bảo trì đúng KH','%',100,'gte','monthly','SL BT thực hiện / SL BT theo lịch'),
  ('KT-05','MAINTENANCE','Độ chính xác bản vẽ','%',99,'gte','monthly','BV chính xác / Tổng BV ban hành'),
  ('KT-06','MAINTENANCE','Thời gian hoàn thành bản vẽ','%',99,'gte','monthly','BV đúng tiến độ / Tổng BV'),
  ('KT-07','MAINTENANCE','Độ chính xác khảo sát CT','%',95,'gte','monthly','(Tổng - Lỗi) / Tổng thông tin khảo sát'),
  ('KH-02','COORDINATION','Tỷ lệ hư hỏng vận chuyển','%',0.1,'lte','monthly','KL hư hỏng / Tổng KL vận chuyển'),
  ('KH-03','COORDINATION','Chi phí giao hàng (vs baseline)','%',90,'lte','monthly','Chi phí/tấn năm nay / Chi phí/tấn baseline'),
  ('KH-04','COORDINATION','Tỷ lệ 5S Bộ phận','%',90,'gte','monthly','Hình 5S khắc phục / Tổng hình phát hiện'),
  ('KH-05','COORDINATION','Số liệu thống kê báo cáo','%',100,'gte','monthly','Báo cáo đúng hạn / Tổng báo cáo'),
  ('KH-06','COORDINATION','Xây dựng quy trình ISO','%',90,'gte','quarterly','QT hoàn thành / Tổng QT theo KH'),
  ('KH-07','COORDINATION','Tỷ lệ giao hàng đúng hạn','%',99,'gte','monthly','Đơn giao đúng hạn / Tổng đơn')
ON CONFLICT (kpi_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kpi_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  effective_year INTEGER NOT NULL,
  effective_month INTEGER,
  notes TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.kpi_baselines (baseline_key, description, value, unit, effective_year) VALUES
  ('delivery_cost_per_ton_2025', 'Chi phí giao hàng/tấn TB năm 2025 (dùng cho KH-03)', 0, 'VND/tấn', 2025),
  ('material_norm_cost_2025', 'Chi phí NVL theo định mức 2025 (tham chiếu cho SX-04)', 0, 'VND', 2025)
ON CONFLICT (baseline_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_kpi_target(
  p_kpi_code TEXT,
  p_period TEXT
) RETURNS NUMERIC AS $$
  SELECT COALESCE(
    CASE p_period
      WHEN 'weekly'    THEN target_weekly
      WHEN 'monthly'   THEN target_monthly
      WHEN 'quarterly' THEN target_quarterly
      WHEN 'yearly'    THEN target_yearly
    END,
    target_value
  )
  FROM public.kpi_targets
  WHERE kpi_code = p_kpi_code AND is_active = true;
$$ LANGUAGE sql STABLE;

ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_targets_select_all" ON public.kpi_targets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "kpi_targets_modify_admin" ON public.kpi_targets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "kpi_baselines_select_all" ON public.kpi_baselines
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "kpi_baselines_modify_admin" ON public.kpi_baselines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE INDEX IF NOT EXISTS idx_kpi_targets_dept ON public.kpi_targets(department, is_active);
CREATE INDEX IF NOT EXISTS idx_kpi_baselines_key ON public.kpi_baselines(baseline_key);

GRANT EXECUTE ON FUNCTION public.get_kpi_target TO authenticated;
