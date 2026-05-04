ALTER TABLE public.human_resource
  DROP CONSTRAINT IF EXISTS human_resource_factory_valid;

ALTER TABLE public.human_resource
  ADD CONSTRAINT human_resource_factory_valid
  CHECK (factory IS NULL OR factory IN ('DMC1', 'DMC3', 'DMC4', 'DMC5', 'PKT-SX', 'DIEU-PHOI', 'Khác'));
