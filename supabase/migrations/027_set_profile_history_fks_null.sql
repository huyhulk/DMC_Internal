ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_changed_by_fkey,
  ADD CONSTRAINT audit_log_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.kpi_baselines
  DROP CONSTRAINT IF EXISTS kpi_baselines_updated_by_fkey,
  ADD CONSTRAINT kpi_baselines_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.production_defects
  DROP CONSTRAINT IF EXISTS production_defects_reported_by_fkey,
  ADD CONSTRAINT production_defects_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.findings_5s
  DROP CONSTRAINT IF EXISTS findings_5s_created_by_fkey,
  ADD CONSTRAINT findings_5s_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.machine_breakdowns
  DROP CONSTRAINT IF EXISTS machine_breakdowns_created_by_fkey,
  ADD CONSTRAINT machine_breakdowns_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.overtime_records
  DROP CONSTRAINT IF EXISTS overtime_records_created_by_fkey,
  ADD CONSTRAINT overtime_records_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.overtime_imports
  DROP CONSTRAINT IF EXISTS overtime_imports_imported_by_fkey,
  ADD CONSTRAINT overtime_imports_imported_by_fkey
    FOREIGN KEY (imported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.overtime_requests
  ALTER COLUMN requested_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS overtime_requests_requested_by_fkey,
  ADD CONSTRAINT overtime_requests_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS overtime_requests_approved_by_fkey,
  ADD CONSTRAINT overtime_requests_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_schedule
  DROP CONSTRAINT IF EXISTS maintenance_schedule_requested_by_fkey,
  ADD CONSTRAINT maintenance_schedule_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS maintenance_schedule_approved_by_fkey,
  ADD CONSTRAINT maintenance_schedule_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
