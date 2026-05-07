BEGIN;

ALTER TABLE public.hr_daily
  ADD COLUMN IF NOT EXISTS transfer_records JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.hr_daily
SET transfer_records = '[]'::jsonb
WHERE transfer_records IS NULL;

ALTER TABLE public.role_tab_permissions DROP CONSTRAINT IF EXISTS role_tab_permissions_role_check;
ALTER TABLE public.role_tab_permissions
  ADD CONSTRAINT role_tab_permissions_role_check
  CHECK (role IN ('ADMIN', 'MANAGER', 'WORKSHOP_MANAGER', 'TEAM_LEADER', 'MAINTENANCE', 'COORDINATION', 'SALES', 'HR'));

NOTIFY pgrst, 'reload schema';

COMMIT;
