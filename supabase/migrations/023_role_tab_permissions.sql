BEGIN;

CREATE TABLE IF NOT EXISTS public.role_tab_permissions (
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'SUPERVISOR', 'USER')),
  permission_key TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('invisible', 'view', 'edit')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission_key)
);

ALTER TABLE public.role_tab_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_tab_permissions_select_authenticated
ON public.role_tab_permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY role_tab_permissions_admin_all
ON public.role_tab_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
);

CREATE OR REPLACE FUNCTION public.touch_role_tab_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_tab_permissions_updated_at ON public.role_tab_permissions;
CREATE TRIGGER trg_role_tab_permissions_updated_at
BEFORE UPDATE ON public.role_tab_permissions
FOR EACH ROW
EXECUTE FUNCTION public.touch_role_tab_permissions_updated_at();

INSERT INTO public.role_tab_permissions (role, permission_key, level)
VALUES
  ('ADMIN', 'production', 'edit'),
  ('ADMIN', 'maintenance', 'edit'),
  ('ADMIN', 'coordination', 'edit'),
  ('ADMIN', 'administration', 'edit'),
  ('ADMIN', 'report', 'edit'),
  ('ADMIN', 'admin', 'edit'),
  ('ADMIN', 'maintenance.breakdowns', 'edit'),
  ('ADMIN', 'maintenance.schedule', 'edit'),
  ('ADMIN', 'maintenance.drawings', 'edit'),
  ('ADMIN', 'maintenance.surveys', 'edit'),
  ('ADMIN', 'maintenance.machines', 'edit'),
  ('ADMIN', 'coordination.delivery', 'edit'),
  ('ADMIN', 'coordination.findings5s', 'edit'),
  ('ADMIN', 'coordination.reports', 'edit'),
  ('ADMIN', 'administration.overtime', 'edit'),
  ('ADMIN', 'administration.hr', 'edit'),
  ('ADMIN', 'administration.findings5s', 'edit'),
  ('ADMIN', 'administration.iso', 'edit'),
  ('ADMIN', 'admin.users', 'edit'),
  ('ADMIN', 'admin.kpi-settings', 'edit'),
  ('MANAGER', 'production', 'edit'),
  ('MANAGER', 'maintenance', 'edit'),
  ('MANAGER', 'coordination', 'edit'),
  ('MANAGER', 'administration', 'edit'),
  ('MANAGER', 'report', 'view'),
  ('MANAGER', 'admin', 'invisible'),
  ('MANAGER', 'maintenance.breakdowns', 'edit'),
  ('MANAGER', 'maintenance.schedule', 'edit'),
  ('MANAGER', 'maintenance.drawings', 'edit'),
  ('MANAGER', 'maintenance.surveys', 'edit'),
  ('MANAGER', 'maintenance.machines', 'edit'),
  ('MANAGER', 'coordination.delivery', 'edit'),
  ('MANAGER', 'coordination.findings5s', 'edit'),
  ('MANAGER', 'coordination.reports', 'edit'),
  ('MANAGER', 'administration.overtime', 'edit'),
  ('MANAGER', 'administration.hr', 'edit'),
  ('MANAGER', 'administration.findings5s', 'edit'),
  ('MANAGER', 'administration.iso', 'edit'),
  ('MANAGER', 'admin.users', 'invisible'),
  ('MANAGER', 'admin.kpi-settings', 'invisible'),
  ('SUPERVISOR', 'production', 'edit'),
  ('SUPERVISOR', 'maintenance', 'invisible'),
  ('SUPERVISOR', 'coordination', 'edit'),
  ('SUPERVISOR', 'administration', 'edit'),
  ('SUPERVISOR', 'report', 'view'),
  ('SUPERVISOR', 'admin', 'invisible'),
  ('SUPERVISOR', 'maintenance.breakdowns', 'invisible'),
  ('SUPERVISOR', 'maintenance.schedule', 'invisible'),
  ('SUPERVISOR', 'maintenance.drawings', 'invisible'),
  ('SUPERVISOR', 'maintenance.surveys', 'invisible'),
  ('SUPERVISOR', 'maintenance.machines', 'invisible'),
  ('SUPERVISOR', 'coordination.delivery', 'edit'),
  ('SUPERVISOR', 'coordination.findings5s', 'edit'),
  ('SUPERVISOR', 'coordination.reports', 'edit'),
  ('SUPERVISOR', 'administration.overtime', 'edit'),
  ('SUPERVISOR', 'administration.hr', 'view'),
  ('SUPERVISOR', 'administration.findings5s', 'edit'),
  ('SUPERVISOR', 'administration.iso', 'view'),
  ('SUPERVISOR', 'admin.users', 'invisible'),
  ('SUPERVISOR', 'admin.kpi-settings', 'invisible'),
  ('USER', 'production', 'edit'),
  ('USER', 'maintenance', 'invisible'),
  ('USER', 'coordination', 'invisible'),
  ('USER', 'administration', 'edit'),
  ('USER', 'report', 'invisible'),
  ('USER', 'admin', 'invisible'),
  ('USER', 'maintenance.breakdowns', 'invisible'),
  ('USER', 'maintenance.schedule', 'invisible'),
  ('USER', 'maintenance.drawings', 'invisible'),
  ('USER', 'maintenance.surveys', 'invisible'),
  ('USER', 'maintenance.machines', 'invisible'),
  ('USER', 'coordination.delivery', 'invisible'),
  ('USER', 'coordination.findings5s', 'invisible'),
  ('USER', 'coordination.reports', 'invisible'),
  ('USER', 'administration.overtime', 'edit'),
  ('USER', 'administration.hr', 'invisible'),
  ('USER', 'administration.findings5s', 'invisible'),
  ('USER', 'administration.iso', 'invisible'),
  ('USER', 'admin.users', 'invisible'),
  ('USER', 'admin.kpi-settings', 'invisible')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
