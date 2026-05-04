-- Helper: trả về metadata kỳ báo cáo
CREATE OR REPLACE FUNCTION public.get_period_range(
  p_period_type TEXT,
  p_anchor_date DATE
) RETURNS TABLE (period_start DATE, period_end DATE, period_label TEXT) AS $$
BEGIN
  IF p_period_type = 'weekly' THEN
    RETURN QUERY SELECT
      date_trunc('week', p_anchor_date)::DATE,
      (date_trunc('week', p_anchor_date) + INTERVAL '6 days')::DATE,
      to_char(p_anchor_date, 'IYYY-"W"IW');
  ELSIF p_period_type = 'monthly' THEN
    RETURN QUERY SELECT
      date_trunc('month', p_anchor_date)::DATE,
      (date_trunc('month', p_anchor_date) + INTERVAL '1 month - 1 day')::DATE,
      to_char(p_anchor_date, 'YYYY-MM');
  ELSIF p_period_type = 'quarterly' THEN
    RETURN QUERY SELECT
      date_trunc('quarter', p_anchor_date)::DATE,
      (date_trunc('quarter', p_anchor_date) + INTERVAL '3 months - 1 day')::DATE,
      to_char(p_anchor_date, 'YYYY-"Q"Q');
  ELSIF p_period_type = 'yearly' THEN
    RETURN QUERY SELECT
      date_trunc('year', p_anchor_date)::DATE,
      (date_trunc('year', p_anchor_date) + INTERVAL '1 year - 1 day')::DATE,
      to_char(p_anchor_date, 'YYYY');
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC chính: tính KPI cho 1 bộ phận, 1 period kỳ bất kỳ
CREATE OR REPLACE FUNCTION public.rpc_calculate_kpi(
  p_department TEXT,
  p_period_type TEXT,
  p_anchor_date DATE,
  p_workshop TEXT DEFAULT NULL
)
RETURNS TABLE (
  kpi_code TEXT,
  kpi_name TEXT,
  target_value NUMERIC,
  target_operator TEXT,
  actual_value NUMERIC,
  unit TEXT,
  is_achieved BOOLEAN,
  achievement_pct NUMERIC,
  data_count INTEGER,
  period_start DATE,
  period_end DATE,
  period_label TEXT,
  default_period TEXT,
  is_period_match BOOLEAN
) AS $$
DECLARE
  v_from DATE;
  v_to DATE;
  v_label TEXT;
BEGIN
  SELECT pr.period_start, pr.period_end, pr.period_label INTO v_from, v_to, v_label
  FROM public.get_period_range(p_period_type, p_anchor_date) pr;

  IF p_workshop IS NOT NULL THEN
    p_workshop := CASE p_workshop
      WHEN 'DM1' THEN 'DMC1' WHEN 'DM2' THEN 'DMC1'
      WHEN 'DM3' THEN 'DMC3' WHEN 'DM4' THEN 'DMC4' WHEN 'DM5' THEN 'DMC5'
      ELSE p_workshop END;
  END IF;

  -- ============== PRODUCTION ==============
  IF p_department = 'PRODUCTION' THEN
    RETURN QUERY
    SELECT
      'SX-01'::TEXT, 'Tỷ lệ lỗi thành phẩm'::TEXT,
      public.get_kpi_target('SX-01', p_period_type), 'lte'::TEXT,
      COALESCE(SUM(d.defect_qty) / NULLIF(SUM(d.total_qty), 0) * 100, 0), '%'::TEXT,
      COALESCE(SUM(d.defect_qty) / NULLIF(SUM(d.total_qty), 0) * 100, 0) <= public.get_kpi_target('SX-01', p_period_type),
      CASE WHEN SUM(d.total_qty) = 0 THEN 100
           ELSE LEAST(100, public.get_kpi_target('SX-01', p_period_type) /
                NULLIF(SUM(d.defect_qty) / NULLIF(SUM(d.total_qty), 0) * 100, 0) * 100) END,
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.production_defects d
    WHERE d.report_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR d.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'SX-02'::TEXT, 'Đúng tiến độ đơn hàng'::TEXT,
      public.get_kpi_target('SX-02', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE o.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE o.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('SX-02', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE o.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0)
            / NULLIF(public.get_kpi_target('SX-02', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.order_completion o
    WHERE o.planned_date BETWEEN v_from AND v_to AND o.status = 'completed'
      AND (p_workshop IS NULL OR o.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'SX-04'::TEXT, 'Chi phí NVL trong định mức'::TEXT,
      public.get_kpi_target('SX-04', p_period_type), 'gte'::TEXT,
      COALESCE(SUM(m.norm_qty) / NULLIF(SUM(m.actual_qty), 0) * 100, 0), '%'::TEXT,
      COALESCE(SUM(m.norm_qty) / NULLIF(SUM(m.actual_qty), 0) * 100, 0) >= public.get_kpi_target('SX-04', p_period_type),
      LEAST(100, COALESCE(SUM(m.norm_qty) / NULLIF(SUM(m.actual_qty), 0) * 100, 0) / NULLIF(public.get_kpi_target('SX-04', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.material_usage m
    WHERE m.report_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR m.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'SX-05'::TEXT, 'Tỷ lệ hoàn thành 5S'::TEXT,
      public.get_kpi_target('SX-05', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('SX-05', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('SX-05', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.findings_5s f
    WHERE f.finding_date BETWEEN v_from AND v_to AND f.department IN ('PRODUCTION','ALL')
      AND (p_workshop IS NULL OR f.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'SX-06'::TEXT, 'Tiến độ thi công công trình'::TEXT,
      public.get_kpi_target('SX-06', p_period_type), 'gte'::TEXT,
      COALESCE(SUM(s.planned_hours) / NULLIF(SUM(s.actual_hours), 0) * 100, 0), '%'::TEXT,
      COALESCE(SUM(s.planned_hours) / NULLIF(SUM(s.actual_hours), 0) * 100, 0) >= public.get_kpi_target('SX-06', p_period_type),
      LEAST(100, COALESCE(SUM(s.planned_hours) / NULLIF(SUM(s.actual_hours), 0) * 100, 0) / NULLIF(public.get_kpi_target('SX-06', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.site_progress s
    WHERE s.start_date BETWEEN v_from AND v_to AND s.status = 'completed';
  END IF;

  -- ============== MAINTENANCE ==============
  IF p_department = 'MAINTENANCE' THEN
    RETURN QUERY
    SELECT
      'KT-01'::TEXT, 'Thời gian dừng máy ngoài KH'::TEXT,
      public.get_kpi_target('KT-01', p_period_type), 'lt'::TEXT,
      COALESCE(SUM(b.downtime_minutes) / 60.0 / NULLIF((v_to - v_from + 1), 0), 0), 'h/ngày'::TEXT,
      COALESCE(SUM(b.downtime_minutes) / 60.0 / NULLIF((v_to - v_from + 1), 0), 0) < public.get_kpi_target('KT-01', p_period_type),
      LEAST(100, public.get_kpi_target('KT-01', p_period_type) / NULLIF(COALESCE(SUM(b.downtime_minutes) / 60.0 / NULLIF((v_to - v_from + 1), 0), 0), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.machine_breakdowns b
    WHERE b.breakdown_start::DATE BETWEEN v_from AND v_to AND b.is_planned = false
      AND (p_workshop IS NULL OR b.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'KT-02'::TEXT, 'Thời gian sửa chữa TB (MTTR)'::TEXT,
      public.get_kpi_target('KT-02', p_period_type), 'lte'::TEXT,
      COALESCE(AVG(b.downtime_minutes), 0), 'phút/lần'::TEXT,
      COALESCE(AVG(b.downtime_minutes), 0) <= public.get_kpi_target('KT-02', p_period_type),
      LEAST(100, public.get_kpi_target('KT-02', p_period_type) / NULLIF(COALESCE(AVG(b.downtime_minutes), 0), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.machine_breakdowns b
    WHERE b.breakdown_start::DATE BETWEEN v_from AND v_to AND b.breakdown_end IS NOT NULL
      AND (p_workshop IS NULL OR b.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'KT-03'::TEXT, 'Thời gian giữa 2 lỗi (MTBF)'::TEXT,
      public.get_kpi_target('KT-03', p_period_type), 'gte'::TEXT,
      CASE WHEN COUNT(*) FILTER (WHERE b.is_planned = false) = 0 THEN 0
           ELSE ((v_to - v_from + 1) * 24 - COALESCE(SUM(b.downtime_minutes)/60, 0))
                / COUNT(*) FILTER (WHERE b.is_planned = false) END,
      'giờ'::TEXT,
      CASE WHEN COUNT(*) FILTER (WHERE b.is_planned = false) = 0 THEN true
           ELSE ((v_to - v_from + 1) * 24 - COALESCE(SUM(b.downtime_minutes)/60, 0))
                / COUNT(*) FILTER (WHERE b.is_planned = false) >= public.get_kpi_target('KT-03', p_period_type) END,
      100::NUMERIC,
      COUNT(*) FILTER (WHERE b.is_planned = false)::INTEGER,
      v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.machine_breakdowns b
    WHERE b.breakdown_start::DATE BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR b.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'KT-04'::TEXT, 'Tỷ lệ bảo trì đúng KH'::TEXT,
      public.get_kpi_target('KT-04', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE m.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE m.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KT-04', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE m.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0)),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.maintenance_schedule m
    WHERE m.scheduled_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR m.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'KT-05'::TEXT, 'Độ chính xác bản vẽ'::TEXT,
      public.get_kpi_target('KT-05', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE NOT t.has_errors)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE NOT t.has_errors)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KT-05', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE NOT t.has_errors)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KT-05', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.technical_drawings t
    WHERE t.delivered_date BETWEEN v_from AND v_to AND t.status IN ('approved','released');

    RETURN QUERY
    SELECT
      'KT-06'::TEXT, 'Thời gian hoàn thành bản vẽ'::TEXT,
      public.get_kpi_target('KT-06', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE t.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE t.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KT-06', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE t.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KT-06', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.technical_drawings t
    WHERE t.due_date BETWEEN v_from AND v_to;

    RETURN QUERY
    SELECT
      'KT-07'::TEXT, 'Độ chính xác khảo sát CT'::TEXT,
      public.get_kpi_target('KT-07', p_period_type), 'gte'::TEXT,
      COALESCE(AVG(s.accuracy_pct), 0), '%'::TEXT,
      COALESCE(AVG(s.accuracy_pct), 0) >= public.get_kpi_target('KT-07', p_period_type),
      LEAST(100, COALESCE(AVG(s.accuracy_pct), 0) / NULLIF(public.get_kpi_target('KT-07', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.site_surveys s
    WHERE s.survey_date BETWEEN v_from AND v_to;
  END IF;

  -- ============== COORDINATION ==============
  IF p_department = 'COORDINATION' THEN
    RETURN QUERY
    SELECT
      'KH-02'::TEXT, 'Tỷ lệ hư hỏng vận chuyển'::TEXT,
      public.get_kpi_target('KH-02', p_period_type), 'lte'::TEXT,
      COALESCE(SUM(d.damaged_weight_tons) / NULLIF(SUM(d.total_weight_tons), 0) * 100, 0), '%'::TEXT,
      COALESCE(SUM(d.damaged_weight_tons) / NULLIF(SUM(d.total_weight_tons), 0) * 100, 0) <= public.get_kpi_target('KH-02', p_period_type),
      CASE WHEN SUM(d.total_weight_tons) = 0 THEN 100
           ELSE LEAST(100, public.get_kpi_target('KH-02', p_period_type) / NULLIF(SUM(d.damaged_weight_tons) / NULLIF(SUM(d.total_weight_tons), 0) * 100, 0) * 100) END,
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.deliveries d
    WHERE d.actual_date BETWEEN v_from AND v_to;

    RETURN QUERY
    WITH baseline AS (
      SELECT value FROM public.kpi_baselines WHERE baseline_key = 'delivery_cost_per_ton_2025' LIMIT 1
    ),
    current_period AS (
      SELECT AVG(d.cost_per_ton) AS avg_cost FROM public.deliveries d
      WHERE d.actual_date BETWEEN v_from AND v_to AND d.total_weight_tons > 0
    )
    SELECT
      'KH-03'::TEXT, 'Chi phí giao hàng (vs baseline)'::TEXT,
      public.get_kpi_target('KH-03', p_period_type), 'lte'::TEXT,
      CASE WHEN COALESCE((SELECT value FROM baseline), 0) > 0
           THEN COALESCE((SELECT avg_cost FROM current_period), 0) / (SELECT value FROM baseline) * 100
           ELSE 0 END,
      '%'::TEXT,
      CASE WHEN COALESCE((SELECT value FROM baseline), 0) > 0
           THEN COALESCE((SELECT avg_cost FROM current_period), 0) / (SELECT value FROM baseline) * 100 <= public.get_kpi_target('KH-03', p_period_type)
           ELSE false END,
      0::NUMERIC,
      (SELECT COUNT(*)::INTEGER FROM public.deliveries WHERE actual_date BETWEEN v_from AND v_to),
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly');

    RETURN QUERY
    SELECT
      'KH-04'::TEXT, 'Tỷ lệ 5S Bộ phận KH'::TEXT,
      public.get_kpi_target('KH-04', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-04', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KH-04', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.findings_5s f
    WHERE f.finding_date BETWEEN v_from AND v_to AND f.department IN ('COORDINATION','ALL');

    RETURN QUERY
    SELECT
      'KH-05'::TEXT, 'Số liệu thống kê báo cáo'::TEXT,
      public.get_kpi_target('KH-05', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE r.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE r.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-05', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE r.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0)),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.statistical_reports r
    WHERE r.due_date BETWEEN v_from AND v_to AND r.status = 'submitted';

    RETURN QUERY
    SELECT
      'KH-06'::TEXT, 'Xây dựng quy trình ISO'::TEXT,
      public.get_kpi_target('KH-06', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE i.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE i.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-06', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE i.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KH-06', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.iso_procedures i
    WHERE i.planned_completion_date BETWEEN v_from AND v_to;

    RETURN QUERY
    SELECT
      'KH-07'::TEXT, 'Tỷ lệ giao hàng đúng hạn'::TEXT,
      public.get_kpi_target('KH-07', p_period_type), 'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE d.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0), '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE d.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-07', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE d.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KH-07', p_period_type), 0) * 100),
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.deliveries d
    WHERE d.planned_date BETWEEN v_from AND v_to AND d.status = 'delivered';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_kpi TO authenticated;

-- RPC: Lịch sử KPI theo time series (cho trend chart)
CREATE OR REPLACE FUNCTION public.rpc_kpi_trend(
  p_kpi_code TEXT,
  p_period_type TEXT,
  p_anchor_date DATE,
  p_count INTEGER DEFAULT 12,
  p_workshop TEXT DEFAULT NULL
)
RETURNS TABLE (
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  actual_value NUMERIC,
  target_value NUMERIC,
  is_achieved BOOLEAN
) AS $$
DECLARE
  v_dept TEXT;
  i INTEGER;
  v_anchor DATE;
BEGIN
  SELECT department INTO v_dept FROM public.kpi_targets WHERE kpi_code = p_kpi_code;
  IF v_dept IS NULL THEN RETURN; END IF;

  FOR i IN REVERSE p_count-1..0 LOOP
    v_anchor := CASE p_period_type
      WHEN 'weekly'    THEN p_anchor_date - (i * INTERVAL '1 week')
      WHEN 'monthly'   THEN p_anchor_date - (i * INTERVAL '1 month')
      WHEN 'quarterly' THEN p_anchor_date - (i * INTERVAL '3 months')
      WHEN 'yearly'    THEN p_anchor_date - (i * INTERVAL '1 year')
    END;

    RETURN QUERY
    SELECT r.period_label, r.period_start, r.period_end, r.actual_value, r.target_value, r.is_achieved
    FROM public.rpc_calculate_kpi(v_dept, p_period_type, v_anchor, p_workshop) r
    WHERE r.kpi_code = p_kpi_code;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_kpi_trend TO authenticated;

-- RPC: Aggregate tăng ca theo PX (multi-period)
CREATE OR REPLACE FUNCTION public.rpc_overtime_summary(
  p_period_type TEXT,
  p_anchor_date DATE,
  p_workshop TEXT DEFAULT NULL
)
RETURNS TABLE (
  workshop TEXT,
  ot_count INTEGER,
  total_employees INTEGER,
  unique_employees INTEGER,
  total_hours NUMERIC,
  by_category JSONB,
  by_reason JSONB,
  period_start DATE,
  period_end DATE,
  period_label TEXT
) AS $$
DECLARE
  v_from DATE; v_to DATE; v_label TEXT;
BEGIN
  SELECT pr.period_start, pr.period_end, pr.period_label INTO v_from, v_to, v_label
  FROM public.get_period_range(p_period_type, p_anchor_date) pr;

  IF p_workshop IS NOT NULL THEN
    p_workshop := CASE p_workshop
      WHEN 'DM1' THEN 'DMC1' WHEN 'DM2' THEN 'DMC1'
      WHEN 'DM3' THEN 'DMC3' WHEN 'DM4' THEN 'DMC4' WHEN 'DM5' THEN 'DMC5'
      ELSE p_workshop END;
  END IF;

  RETURN QUERY
  WITH ot AS (
    SELECT * FROM public.overtime_records
    WHERE ot_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR workshop = p_workshop)
  ),
  base AS (
    SELECT o.workshop, COUNT(*)::INTEGER AS ot_count,
      SUM(o.total_employees)::INTEGER AS total_employees,
      SUM(o.total_hours) AS total_hours
    FROM ot o GROUP BY o.workshop
  ),
  unique_emp AS (
    SELECT o.workshop, COUNT(DISTINCT p.employee_name)::INTEGER AS unique_employees
    FROM ot o JOIN public.overtime_participants p ON p.overtime_id = o.id
    GROUP BY o.workshop
  ),
  cat AS (
    SELECT o.workshop, jsonb_object_agg(o.ot_category, o.total_hours_sum) AS by_category
    FROM (
      SELECT workshop, ot_category, SUM(total_hours) AS total_hours_sum
      FROM ot GROUP BY workshop, ot_category
    ) o GROUP BY o.workshop
  ),
  reasons AS (
    SELECT o.workshop,
      jsonb_build_object(
        'kh_dat_tre',       SUM(CASE WHEN (reasons->>'kh_dat_tre')::boolean       THEN 1 ELSE 0 END),
        'don_hang_nhieu',   SUM(CASE WHEN (reasons->>'don_hang_nhieu')::boolean   THEN 1 ELSE 0 END),
        'noi_bo_sx',        SUM(CASE WHEN (reasons->>'noi_bo_sx')::boolean        THEN 1 ELSE 0 END),
        'xe_vao_tre',       SUM(CASE WHEN (reasons->>'xe_vao_tre')::boolean       THEN 1 ELSE 0 END),
        'don_hang_sll',     SUM(CASE WHEN (reasons->>'don_hang_sll')::boolean     THEN 1 ELSE 0 END),
        'giao_hang_sll',    SUM(CASE WHEN (reasons->>'giao_hang_sll')::boolean    THEN 1 ELSE 0 END),
        'khong_du_nhan_su', SUM(CASE WHEN (reasons->>'khong_du_nhan_su')::boolean THEN 1 ELSE 0 END)
      ) AS by_reason
    FROM ot GROUP BY workshop
  )
  SELECT b.workshop, b.ot_count, b.total_employees,
    COALESCE(u.unique_employees, 0), b.total_hours,
    COALESCE(c.by_category, '{}'::jsonb), COALESCE(r.by_reason, '{}'::jsonb),
    v_from, v_to, v_label
  FROM base b
  LEFT JOIN unique_emp u ON u.workshop = b.workshop
  LEFT JOIN cat c ON c.workshop = b.workshop
  LEFT JOIN reasons r ON r.workshop = b.workshop
  ORDER BY b.workshop;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_overtime_summary TO authenticated;

-- RPC: Top employees có giờ tăng ca cao nhất (multi-period)
CREATE OR REPLACE FUNCTION public.rpc_top_overtime_employees(
  p_period_type TEXT,
  p_anchor_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  employee_name TEXT,
  workshop TEXT,
  ot_count INTEGER,
  total_hours NUMERIC
) AS $$
DECLARE
  v_from DATE; v_to DATE;
BEGIN
  SELECT pr.period_start, pr.period_end INTO v_from, v_to
  FROM public.get_period_range(p_period_type, p_anchor_date) pr;

  RETURN QUERY
  SELECT
    p.employee_name,
    MAX(o.workshop) AS workshop,
    COUNT(*)::INTEGER AS ot_count,
    SUM(COALESCE(p.hours, o.total_hours::NUMERIC / NULLIF(o.total_employees, 0))) AS total_hours
  FROM public.overtime_participants p
  JOIN public.overtime_records o ON o.id = p.overtime_id
  WHERE o.ot_date BETWEEN v_from AND v_to
  GROUP BY p.employee_name
  ORDER BY total_hours DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_top_overtime_employees TO authenticated;

-- RPC: Matrix so sánh KPI x Workshop
CREATE OR REPLACE FUNCTION public.rpc_kpi_workshop_matrix(
  p_department TEXT,
  p_period_type TEXT,
  p_anchor_date DATE
)
RETURNS TABLE (
  kpi_code TEXT,
  kpi_name TEXT,
  workshop TEXT,
  target_value NUMERIC,
  target_operator TEXT,
  actual_value NUMERIC,
  is_achieved BOOLEAN,
  achievement_pct NUMERIC,
  data_count INTEGER
) AS $$
DECLARE
  ws TEXT;
  ws_list TEXT[] := ARRAY['DMC1','DMC3','DMC4','DMC5'];
BEGIN
  FOREACH ws IN ARRAY ws_list LOOP
    RETURN QUERY
    SELECT
      r.kpi_code, r.kpi_name, ws,
      r.target_value, r.target_operator,
      r.actual_value, r.is_achieved, r.achievement_pct, r.data_count
    FROM public.rpc_calculate_kpi(p_department, p_period_type, p_anchor_date, ws) r;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_kpi_workshop_matrix TO authenticated;
