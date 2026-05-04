BEGIN;

ALTER TABLE public."Production"
  ADD COLUMN IF NOT EXISTS save_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public."Production" DROP CONSTRAINT IF EXISTS production_save_status_check;
ALTER TABLE public."Production"
  ADD CONSTRAINT production_save_status_check
  CHECK (save_status IN ('draft', 'closed'));

CREATE INDEX IF NOT EXISTS production_created_at_idx ON public."Production" (created_at DESC);
CREATE INDEX IF NOT EXISTS production_pdate_pcode_idx ON public."Production" (pdate, pcode);
CREATE INDEX IF NOT EXISTS production_save_status_idx ON public."Production" (save_status);

INSERT INTO public.role_tab_permissions (role, permission_key, level)
VALUES
  ('ADMIN', 'production.input-history', 'edit'),
  ('MANAGER', 'production.input-history', 'edit'),
  ('WORKSHOP_MANAGER', 'production.input-history', 'edit'),
  ('TEAM_LEADER', 'production.input-history', 'edit'),
  ('MAINTENANCE', 'production.input-history', 'invisible'),
  ('COORDINATION', 'production.input-history', 'invisible'),
  ('SALES', 'production.input-history', 'invisible'),
  ('HR', 'production.input-history', 'invisible')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
