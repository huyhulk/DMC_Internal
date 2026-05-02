-- Cleanup pass: fix overtime KPI RPC ambiguity and tighten HR daily writes.

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
  v_from DATE;
  v_to DATE;
  v_label TEXT;
  v_workshop TEXT;
BEGIN
  SELECT pr.period_start, pr.period_end, pr.period_label
    INTO v_from, v_to, v_label
  FROM public.get_period_range(p_period_type, p_anchor_date) pr;

  v_workshop := CASE UPPER(TRIM(COALESCE(p_workshop, '')))
    WHEN '' THEN NULL
    WHEN 'ALL' THEN NULL
    WHEN 'DM1' THEN 'DMC1'
    WHEN 'DM2' THEN 'DMC1'
    WHEN 'DM3' THEN 'DMC3'
    WHEN 'DM4' THEN 'DMC4'
    WHEN 'DM5' THEN 'DMC5'
    ELSE UPPER(TRIM(p_workshop))
  END;

  RETURN QUERY
  WITH ot AS (
    SELECT o.*
    FROM public.overtime_records o
    WHERE o.ot_date BETWEEN v_from AND v_to
      AND (v_workshop IS NULL OR o.workshop = v_workshop)
  ),
  base AS (
    SELECT
      o.workshop,
      COUNT(*)::INTEGER AS ot_count,
      COALESCE(SUM(o.total_employees), 0)::INTEGER AS total_employees,
      COALESCE(SUM(o.total_hours), 0)::NUMERIC AS total_hours
    FROM ot o
    GROUP BY o.workshop
  ),
  unique_emp AS (
    SELECT
      o.workshop,
      COUNT(DISTINCT p.employee_name)::INTEGER AS unique_employees
    FROM ot o
    JOIN public.overtime_participants p ON p.overtime_id = o.id
    GROUP BY o.workshop
  ),
  cat AS (
    SELECT
      grouped.workshop,
      jsonb_object_agg(grouped.ot_category, grouped.total_hours_sum) AS by_category
    FROM (
      SELECT
        o.workshop,
        o.ot_category,
        SUM(o.total_hours) AS total_hours_sum
      FROM ot o
      GROUP BY o.workshop, o.ot_category
    ) grouped
    GROUP BY grouped.workshop
  ),
  reasons AS (
    SELECT
      o.workshop,
      jsonb_build_object(
        'kh_dat_tre',       SUM(CASE WHEN COALESCE((o.reasons->>'kh_dat_tre')::BOOLEAN, false)       THEN 1 ELSE 0 END),
        'don_hang_nhieu',   SUM(CASE WHEN COALESCE((o.reasons->>'don_hang_nhieu')::BOOLEAN, false)   THEN 1 ELSE 0 END),
        'noi_bo_sx',        SUM(CASE WHEN COALESCE((o.reasons->>'noi_bo_sx')::BOOLEAN, false)        THEN 1 ELSE 0 END),
        'xe_vao_tre',       SUM(CASE WHEN COALESCE((o.reasons->>'xe_vao_tre')::BOOLEAN, false)       THEN 1 ELSE 0 END),
        'don_hang_sll',     SUM(CASE WHEN COALESCE((o.reasons->>'don_hang_sll')::BOOLEAN, false)     THEN 1 ELSE 0 END),
        'giao_hang_sll',    SUM(CASE WHEN COALESCE((o.reasons->>'giao_hang_sll')::BOOLEAN, false)    THEN 1 ELSE 0 END),
        'khong_du_nhan_su', SUM(CASE WHEN COALESCE((o.reasons->>'khong_du_nhan_su')::BOOLEAN, false) THEN 1 ELSE 0 END)
      ) AS by_reason
    FROM ot o
    GROUP BY o.workshop
  )
  SELECT
    b.workshop,
    b.ot_count,
    b.total_employees,
    COALESCE(u.unique_employees, 0)::INTEGER,
    b.total_hours,
    COALESCE(c.by_category, '{}'::JSONB),
    COALESCE(r.by_reason, '{}'::JSONB),
    v_from,
    v_to,
    v_label
  FROM base b
  LEFT JOIN unique_emp u ON u.workshop = b.workshop
  LEFT JOIN cat c ON c.workshop = b.workshop
  LEFT JOIN reasons r ON r.workshop = b.workshop
  ORDER BY b.workshop;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_overtime_summary TO authenticated;

DROP POLICY IF EXISTS "hr_daily_upsert_admin" ON public.hr_daily;
DROP POLICY IF EXISTS "hr_daily_modify_admin" ON public.hr_daily;

CREATE POLICY "hr_daily_modify_admin"
  ON public.hr_daily
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'MANAGER')
    )
  );

DROP TRIGGER IF EXISTS set_human_resource_updated_at ON public.human_resource;
CREATE TRIGGER set_human_resource_updated_at
  BEFORE UPDATE ON public.human_resource
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_hr_daily_updated_at ON public.hr_daily;
CREATE TRIGGER set_hr_daily_updated_at
  BEFORE UPDATE ON public.hr_daily
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'human_resource_factory_valid'
      AND conrelid = 'public.human_resource'::regclass
  ) THEN
    ALTER TABLE public.human_resource
      ADD CONSTRAINT human_resource_factory_valid
      CHECK (factory IS NULL OR factory IN ('DMC1', 'DMC3', 'DMC4', 'DMC5'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hr_daily_factory_valid'
      AND conrelid = 'public.hr_daily'::regclass
  ) THEN
    ALTER TABLE public.hr_daily
      ADD CONSTRAINT hr_daily_factory_valid
      CHECK (factory IN ('DMC1', 'DMC3', 'DMC4', 'DMC5'))
      NOT VALID;
  END IF;
END $$;
