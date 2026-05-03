-- Add approval workflow for overtime requests and maintenance schedules.

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_date DATE NOT NULL,
  customer TEXT,
  pcode TEXT,
  workshop TEXT NOT NULL,
  original_workshop TEXT,
  ot_category TEXT NOT NULL CHECK (ot_category IN ('PRODUCTION','DELIVERY','INTERNAL')),
  reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_employees INTEGER NOT NULL DEFAULT 0,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  required_output NUMERIC,
  planned_hours NUMERIC,
  notes TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  approval_note TEXT,
  approved_overtime_id UUID REFERENCES public.overtime_records(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_requests_date_ws ON public.overtime_requests(ot_date, workshop);
CREATE INDEX IF NOT EXISTS idx_ot_requests_status ON public.overtime_requests(approval_status, ot_date);
CREATE INDEX IF NOT EXISTS idx_ot_requests_requested_by ON public.overtime_requests(requested_by);

CREATE TABLE IF NOT EXISTS public.overtime_request_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.overtime_requests(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  employee_name TEXT NOT NULL,
  hours NUMERIC NOT NULL CHECK (hours > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, employee_name)
);

CREATE INDEX IF NOT EXISTS idx_ot_req_part_request ON public.overtime_request_participants(request_id);
CREATE INDEX IF NOT EXISTS idx_ot_req_part_name ON public.overtime_request_participants(employee_name);

DROP TRIGGER IF EXISTS trg_normalize_ot_request_workshop_biu ON public.overtime_requests;
CREATE TRIGGER trg_normalize_ot_request_workshop_biu
  BEFORE INSERT OR UPDATE OF workshop ON public.overtime_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_ot_workshop();

DROP TRIGGER IF EXISTS set_overtime_requests_updated_at ON public.overtime_requests;
CREATE TRIGGER set_overtime_requests_updated_at
  BEFORE UPDATE ON public.overtime_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_request_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ot_insert" ON public.overtime_records;
DROP POLICY IF EXISTS "ot_requests_select_scoped" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_requests_insert_scoped" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_requests_update_approver" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_requests_delete_owner_pending" ON public.overtime_requests;
DROP POLICY IF EXISTS "ot_req_part_select_scoped" ON public.overtime_request_participants;
DROP POLICY IF EXISTS "ot_req_part_insert_owner" ON public.overtime_request_participants;

CREATE POLICY "ot_requests_select_scoped" ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('ADMIN','MANAGER')
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1
            FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE UPPER(TRIM(ws)) = overtime_requests.workshop
          )
        )
    )
  );

CREATE POLICY "ot_requests_insert_scoped" ON public.overtime_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('ADMIN','MANAGER')
          OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
          OR EXISTS (
            SELECT 1
            FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
            WHERE UPPER(TRIM(ws)) = overtime_requests.workshop
          )
        )
    )
  );

CREATE POLICY "ot_requests_update_approver" ON public.overtime_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ADMIN','MANAGER')
    )
  );

CREATE POLICY "ot_requests_delete_owner_pending" ON public.overtime_requests
  FOR DELETE TO authenticated
  USING (
    requested_by = auth.uid()
    AND approval_status = 'pending'
  );

CREATE POLICY "ot_req_part_select_scoped" ON public.overtime_request_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.overtime_requests r
      WHERE r.id = overtime_request_participants.request_id
        AND (
          r.requested_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.role IN ('ADMIN','MANAGER')
                OR UPPER(TRIM(COALESCE(p.workspace, ''))) = 'ALL'
                OR EXISTS (
                  SELECT 1
                  FROM unnest(string_to_array(COALESCE(p.workspace, ''), ',')) ws
                  WHERE UPPER(TRIM(ws)) = r.workshop
                )
              )
          )
        )
    )
  );

CREATE POLICY "ot_req_part_insert_owner" ON public.overtime_request_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.overtime_requests r
      WHERE r.id = overtime_request_participants.request_id
        AND r.requested_by = auth.uid()
        AND r.approval_status = 'pending'
    )
  );

ALTER TABLE public.maintenance_schedule
  ADD COLUMN IF NOT EXISTS approval_status TEXT,
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

UPDATE public.maintenance_schedule
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, created_at)
WHERE approval_status IS NULL;

ALTER TABLE public.maintenance_schedule
  ALTER COLUMN approval_status SET DEFAULT 'pending',
  ALTER COLUMN approval_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'maintenance_schedule_approval_status_valid'
      AND conrelid = 'public.maintenance_schedule'::regclass
  ) THEN
    ALTER TABLE public.maintenance_schedule
      ADD CONSTRAINT maintenance_schedule_approval_status_valid
      CHECK (approval_status IN ('pending','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maint_sched_approval
  ON public.maintenance_schedule(approval_status, scheduled_date);

CREATE OR REPLACE FUNCTION public.rpc_review_overtime_request(
  p_request_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_role TEXT;
  v_request public.overtime_requests%ROWTYPE;
  v_overtime_id UUID;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role NOT IN ('ADMIN','MANAGER') THEN
    RAISE EXCEPTION 'Only ADMIN or MANAGER can review overtime requests';
  END IF;

  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT *
    INTO v_request
  FROM public.overtime_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Overtime request not found';
  END IF;

  IF v_request.approval_status <> 'pending' THEN
    RAISE EXCEPTION 'Overtime request has already been reviewed';
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.overtime_requests
    SET approval_status = 'rejected',
        approved_by = auth.uid(),
        approved_at = NOW(),
        approval_note = p_note
    WHERE id = p_request_id;

    RETURN NULL;
  END IF;

  INSERT INTO public.overtime_records (
    ot_date,
    customer,
    pcode,
    workshop,
    original_workshop,
    ot_category,
    reasons,
    total_employees,
    total_hours,
    required_output,
    planned_hours,
    notes,
    source,
    source_ref,
    created_by
  )
  VALUES (
    v_request.ot_date,
    v_request.customer,
    v_request.pcode,
    v_request.workshop,
    COALESCE(v_request.original_workshop, v_request.workshop),
    v_request.ot_category,
    v_request.reasons,
    v_request.total_employees,
    v_request.total_hours,
    v_request.required_output,
    v_request.planned_hours,
    v_request.notes,
    'manual',
    'overtime_request:' || v_request.id::TEXT,
    v_request.requested_by
  )
  RETURNING id INTO v_overtime_id;

  INSERT INTO public.overtime_participants (
    overtime_id,
    employee_id,
    employee_name,
    hours
  )
  SELECT
    v_overtime_id,
    employee_id,
    employee_name,
    hours
  FROM public.overtime_request_participants
  WHERE request_id = p_request_id;

  UPDATE public.overtime_requests
  SET approval_status = 'approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      approval_note = p_note,
      approved_overtime_id = v_overtime_id
  WHERE id = p_request_id;

  RETURN v_overtime_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.rpc_review_overtime_request(UUID, TEXT, TEXT) TO authenticated;
