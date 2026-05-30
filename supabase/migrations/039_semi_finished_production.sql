-- ============================================================
-- 039: Semi-finished production entry
-- Separate semi-finished output from finished-goods "Production"
-- so it does not affect LSX progress / auto-close logic.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.semi_finished_production (
  id BIGSERIAL PRIMARY KEY,

  -- Link to source production order (data."PCODE")
  pdate DATE NOT NULL,
  pcode TEXT NOT NULL,

  -- Scope / authorization
  workshop TEXT NOT NULL,

  -- Product information
  products TEXT,
  material TEXT DEFAULT '',

  -- Output quantities
  quantity NUMERIC NOT NULL DEFAULT 0,
  defect_quantity NUMERIC NOT NULL DEFAULT 0,
  recycle_quantity NUMERIC NOT NULL DEFAULT 0,

  -- Labor / time
  workforce NUMERIC NOT NULL DEFAULT 0,
  starttime TEXT DEFAULT '',
  endtime TEXT DEFAULT '',
  realnorm NUMERIC NOT NULL DEFAULT 0,

  -- Notes / audit
  log TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT semi_finished_production_quantity_check
    CHECK (quantity >= 0),
  CONSTRAINT semi_finished_production_defect_quantity_check
    CHECK (defect_quantity >= 0),
  CONSTRAINT semi_finished_production_recycle_quantity_check
    CHECK (recycle_quantity >= 0),
  CONSTRAINT semi_finished_production_workforce_check
    CHECK (workforce >= 0)
);

CREATE INDEX IF NOT EXISTS idx_semi_finished_production_pdate
  ON public.semi_finished_production (pdate);

CREATE INDEX IF NOT EXISTS idx_semi_finished_production_pcode
  ON public.semi_finished_production (pcode);

CREATE INDEX IF NOT EXISTS idx_semi_finished_production_workshop_pdate
  ON public.semi_finished_production (workshop, pdate);

CREATE INDEX IF NOT EXISTS idx_semi_finished_production_created_at
  ON public.semi_finished_production (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_semi_finished_production_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_semi_finished_production_created_by
  BEFORE INSERT ON public.semi_finished_production
  FOR EACH ROW EXECUTE FUNCTION public.set_semi_finished_production_created_by();

CREATE TRIGGER set_semi_finished_production_updated_at
  BEFORE UPDATE ON public.semi_finished_production
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.semi_finished_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "semi_finished_production_select_authenticated"
  ON public.semi_finished_production
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "semi_finished_production_insert_workshop_allowed"
  ON public.semi_finished_production
  FOR INSERT TO authenticated
  WITH CHECK (
    check_production_insert_permission(pcode, workshop)
    AND (created_by IS NULL OR created_by = auth.uid())
  );
