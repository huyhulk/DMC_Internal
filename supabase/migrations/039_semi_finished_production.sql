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

CREATE OR REPLACE FUNCTION public.check_semi_finished_production_insert_permission(p_pcode TEXT, p_workshop TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       TEXT;
  v_workspace  TEXT;
  v_workspaces TEXT[];
  v_workshop   TEXT;
  v_description TEXT;
  v_entry_workshop TEXT;
  v_base_workshop TEXT;
BEGIN
  SELECT role, workspace
  INTO v_role, v_workspace
  FROM profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  SELECT "WORKSHOP", "DESCRIPTION"
  INTO v_workshop, v_description
  FROM data
  WHERE "PCODE" = p_pcode
  LIMIT 1;

  IF v_workshop IS NULL THEN RETURN FALSE;
  ELSIF v_workshop ILIKE 'Phân xưởng 1%' OR v_workshop ILIKE 'Phân xưởng 2%' OR upper(v_workshop) = 'DMC1' THEN
    v_base_workshop := 'DMC1';
    IF coalesce(v_description, '') ILIKE '%pu%' THEN
      v_entry_workshop := 'DMC1-PU';
    ELSIF coalesce(v_description, '') ILIKE '%phụ kiện%' OR coalesce(v_description, '') ILIKE '%pk%' THEN
      v_entry_workshop := 'DMC1-PK';
    ELSE
      v_entry_workshop := 'DMC1-CT';
    END IF;
  ELSIF v_workshop ILIKE 'Phân xưởng 3%' OR upper(v_workshop) = 'DMC3' THEN
    v_base_workshop := 'DMC3';
    v_entry_workshop := 'DMC3';
  ELSIF v_workshop ILIKE 'Phân xưởng 4%' OR upper(v_workshop) = 'DMC4' THEN
    v_base_workshop := 'DMC4';
    v_entry_workshop := 'DMC4';
  ELSIF v_workshop ILIKE 'Phân xưởng 5%' OR upper(v_workshop) = 'DMC5' THEN
    v_base_workshop := 'DMC5';
    v_entry_workshop := 'DMC5';
  ELSE
    RETURN FALSE;
  END IF;

  IF upper(coalesce(p_workshop, '')) <> v_base_workshop THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'ADMIN' THEN RETURN TRUE; END IF;
  IF upper(btrim(v_workspace)) = 'ALL' THEN RETURN TRUE; END IF;
  IF v_workspace IS NULL OR btrim(v_workspace) = '' THEN RETURN FALSE; END IF;

  v_workspaces := regexp_split_to_array(upper(regexp_replace(v_workspace, '\s+', '', 'g')), ',');

  IF v_base_workshop = 'DMC1' THEN
    RETURN 'DMC1' = ANY(v_workspaces) OR coalesce(v_entry_workshop, '') = ANY(v_workspaces);
  END IF;

  RETURN v_base_workshop = ANY(v_workspaces);
END;
$$;

CREATE POLICY "semi_finished_production_insert_workshop_allowed"
  ON public.semi_finished_production
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_semi_finished_production_insert_permission(pcode, workshop)
    AND (created_by IS NULL OR created_by = auth.uid())
  );
