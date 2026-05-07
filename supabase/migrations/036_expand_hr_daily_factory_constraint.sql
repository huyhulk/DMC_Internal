BEGIN;

ALTER TABLE public.hr_daily
  DROP CONSTRAINT IF EXISTS hr_daily_factory_valid;

ALTER TABLE public.hr_daily
  ADD CONSTRAINT hr_daily_factory_valid
  CHECK (factory IN ('DMC1', 'DMC3', 'DMC4', 'DMC5', 'PKT-SX', 'DIEU-PHOI'));

NOTIFY pgrst, 'reload schema';

COMMIT;
