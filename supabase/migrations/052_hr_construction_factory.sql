-- ============================================================
-- 052: Thêm 'CONG_TRINH' vào check constraint human_resource_factory_valid.
--   Nhóm công trình đã có trong RLS Production (052_restore_construction_production_rls)
--   nhưng chưa được cho phép trong bảng human_resource → không nhập nhân sự được.
-- ============================================================

BEGIN;

ALTER TABLE public.human_resource
  DROP CONSTRAINT IF EXISTS human_resource_factory_valid;

ALTER TABLE public.human_resource
  ADD CONSTRAINT human_resource_factory_valid
  CHECK (factory IS NULL OR factory IN (
    'DMC1', 'DMC3', 'DMC4', 'DMC5',
    'PKT-SX', 'DIEU-PHOI', 'CONG_TRINH', 'Khác'
  ));

NOTIFY pgrst, 'reload schema';

COMMIT;
