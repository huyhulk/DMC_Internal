CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(changed_by, changed_at);

CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_log(table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_log(table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_kpi_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER trg_audit_overtime_records
  AFTER INSERT OR UPDATE OR DELETE ON public.overtime_records
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER trg_audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER trg_audit_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();
