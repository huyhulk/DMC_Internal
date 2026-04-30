-- Migration 016: Fix SX-01 — tính tỷ lệ lỗi từ bảng "Production" thay vì production_defects
-- Lý do: bảng production_defects luôn rỗng; "Production".routput/(eoutput+routput) là nguồn dữ liệu thực.
-- Workshop join qua data."PCODE" = "Production".pcode, chuẩn hoá theo ILIKE pattern giống rpc_fetch_prod_rows.

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
    -- SX-01: Tỷ lệ lỗi thành phẩm — nguồn: "Production".routput / (eoutput + routput)
    RETURN QUERY
    WITH ws AS (
      SELECT DISTINCT ON ("PCODE")
        "PCODE",
        CASE
          WHEN "WORKSHOP" ILIKE 'Phân xưởng 1%' THEN 'DMC1'
          WHEN "WORKSHOP" ILIKE 'Phân xưởng 2%' THEN 'DMC1'
          WHEN "WORKSHOP" ILIKE 'Phân xưởng 3%' THEN 'DMC3'
          WHEN "WORKSHOP" ILIKE 'Phân xưởng 4%' THEN 'DMC4'
          WHEN "WORKSHOP" ILIKE 'Phân xưởng 5%' THEN 'DMC5'
          WHEN "WORKSHOP" ILIKE 'DMC1%'          THEN 'DMC1'
          WHEN "WORKSHOP" ILIKE 'DMC3%'          THEN 'DMC3'
          WHEN "WORKSHOP" ILIKE 'DMC4%'          THEN 'DMC4'
          WHEN "WORKSHOP" ILIKE 'DMC5%'          THEN 'DMC5'
          ELSE 'DMC1'
        END AS ws_code
      FROM public.data
    )
    SELECT
      'SX-01'::TEXT, 'Tỷ lệ lỗi thành phẩm'::TEXT,
      public.get_kpi_target('SX-01', p_period_type), 'lte'::TEXT,
      COALESCE(SUM(p.routput) / NULLIF(SUM(p.eoutput + p.routput), 0) * 100, 0), '%'::TEXT,
      COALESCE(SUM(p.routput) / NULLIF(SUM(p.eoutput + p.routput), 0) * 100, 0) <= public.get_kpi_target('SX-01', p_period_type),
      CASE WHEN SUM(p.eoutput + p.routput) = 0 THEN 100
           ELSE LEAST(100, public.get_kpi_target('SX-01', p_period_type) /
                NULLIF(SUM(p.routput) / NULLIF(SUM(p.eoutput + p.routput), 0) * 100, 0) * 100) END,
      COUNT(*)::INTEGER, v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public."Production" p
    INNER JOIN ws ON ws."PCODE" = p.pcode
    WHERE p.pdate BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR ws.ws_code = p_workshop);

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

-- Verify:
-- SELECT kpi_code, actual_value, data_count FROM rpc_calculate_kpi('PRODUCTION','quarterly','2026-04-30') WHERE kpi_code = 'SX-01';
