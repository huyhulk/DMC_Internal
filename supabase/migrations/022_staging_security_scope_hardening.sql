-- Harden staging authorization boundaries for profiles, HR, overtime, and maintenance.
-- Do not apply directly to production without user approval and staging verification.

BEGIN;

-- Prevent profile self-escalation. Profile role/workspace changes must go through admin flows.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Keep direct reads unchanged, but make write policies explicitly workspace-scoped.
DROP POLICY IF EXISTS "ot_requests_select_scoped" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_requests_insert_scoped" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_requests_update_approver" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_req_part_select_scoped" ON public.overtime_request_participants;

CREATE POLICY "ot_requests_select_scoped" ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = overtime_requests.workshop
          )
        )
    )
  );

CREATE POLICY "ot_requests_insert_scoped" ON public.overtime_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = overtime_requests.workshop
          )
        )
    )
  );

CREATE POLICY "ot_requests_update_approver" ON public.overtime_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = overtime_requests.workshop
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = overtime_requests.workshop
          )
        )
    )
  );

CREATE POLICY "ot_req_part_select_scoped" ON public.overtime_request_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.overtime_requests r
      WHERE r.id = overtime_request_participants.request_id
        AND (
          r.requested_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.role = 'ADMIN'
                OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
                OR EXISTS (
                  SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
                  WHERE public.normalize_workshop(TRIM(ws)) = r.workshop
                )
              )
          )
        )
    )
  );

-- Tighten maintenance schedule RLS added before approval workflow existed.
DROP POLICY IF EXISTS "maint_sched_select" ON public.maintenance_schedule;
DROP POLICY IF EXISTS "maint_sched_insert" ON public.maintenance_schedule;
DROP POLICY IF EXISTS "maint_sched_update_mgr" ON public.maintenance_schedule;
DROP POLICY IF EXISTS "maint_sched_delete_admin" ON public.maintenance_schedule;

CREATE POLICY "maint_sched_select" ON public.maintenance_schedule
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = maintenance_schedule.workshop
          )
        )
    )
  );

CREATE POLICY "maint_sched_insert" ON public.maintenance_schedule
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = maintenance_schedule.workshop
          )
        )
    )
  );

CREATE POLICY "maint_sched_update_mgr" ON public.maintenance_schedule
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = maintenance_schedule.workshop
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = maintenance_schedule.workshop
          )
        )
    )
  );

CREATE POLICY "maint_sched_delete_admin" ON public.maintenance_schedule
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- HR tables are read/write scoped by factory/workspace. Empty workspace denies.
ALTER TABLE IF EXISTS public.human_resource ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hr_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "human_resource_select" ON public.human_resource;
DROP POLICY IF EXISTS "human_resource_modify_admin" ON public.human_resource;
DROP POLICY IF EXISTS "hr_daily_select" ON public.hr_daily;
DROP POLICY IF EXISTS "hr_daily_modify_admin" ON public.hr_daily;

CREATE POLICY "human_resource_select" ON public.human_resource
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = human_resource.factory
          )
        )
    )
  );

CREATE POLICY "human_resource_modify_admin" ON public.human_resource
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = human_resource.factory
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = human_resource.factory
          )
        )
    )
  );

CREATE POLICY "hr_daily_select" ON public.hr_daily
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = hr_daily.factory
          )
        )
    )
  );

CREATE POLICY "hr_daily_modify_admin" ON public.hr_daily
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = hr_daily.factory
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
        AND (
          p.role = 'ADMIN'
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE public.normalize_workshop(TRIM(ws)) = hr_daily.factory
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.rpc_review_overtime_request(
  p_request_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_role TEXT;
  v_workspace TEXT;
  v_request public.overtime_requests%ROWTYPE;
  v_overtime_id UUID;
BEGIN
  SELECT role, workspace INTO v_role, v_workspace
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role NOT IN ('ADMIN','MANAGER') THEN
    RAISE EXCEPTION 'Only ADMIN or MANAGER can review overtime requests';
  END IF;

  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT * INTO v_request
  FROM public.overtime_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Overtime request not found';
  END IF;

  IF v_role <> 'ADMIN'
     AND UPPER(TRIM(COALESCE(v_workspace, ''))) <> 'ALL'
     AND NOT EXISTS (
       SELECT 1 FROM unnest(string_to_array(COALESCE(v_workspace, ''), ',')) ws
       WHERE public.normalize_workshop(TRIM(ws)) = v_request.workshop
     ) THEN
    RAISE EXCEPTION 'Reviewer cannot access overtime request workshop';
  END IF;

  IF v_request.approval_status <> 'pending' THEN
    RAISE EXCEPTION 'Overtime request has already been reviewed';
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.overtime_requests
    SET approval_status = 'rejected', approved_by = auth.uid(), approved_at = NOW(), approval_note = p_note
    WHERE id = p_request_id;
    RETURN NULL;
  END IF;

  INSERT INTO public.overtime_records (
    ot_date, customer, pcode, workshop, original_workshop, ot_category, reasons,
    total_employees, total_hours, required_output, planned_hours, notes, source, source_ref, created_by
  )
  VALUES (
    v_request.ot_date, v_request.customer, v_request.pcode, v_request.workshop,
    COALESCE(v_request.original_workshop, v_request.workshop), v_request.ot_category, v_request.reasons,
    v_request.total_employees, v_request.total_hours, v_request.required_output, v_request.planned_hours,
    v_request.notes, 'manual', 'overtime_request:' || v_request.id::TEXT, v_request.requested_by
  )
  RETURNING id INTO v_overtime_id;

  INSERT INTO public.overtime_participants (overtime_id, employee_id, employee_name, hours)
  SELECT v_overtime_id, employee_id, employee_name, hours
  FROM public.overtime_request_participants
  WHERE request_id = p_request_id;

  UPDATE public.overtime_requests
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = NOW(),
      approval_note = p_note, approved_overtime_id = v_overtime_id
  WHERE id = p_request_id;

  RETURN v_overtime_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.rpc_review_overtime_request(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
