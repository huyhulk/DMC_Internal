-- ============================================================
-- 003: Strict RLS for Production table (defense-in-depth)
-- Primary check: server action recordProductionAction (lib/actions/data.ts)
-- Secondary check: DB-level RLS function below
-- ============================================================

-- Helper: checks if auth.uid() can write a production row for the given pcode.
-- Reads user role+workspace from profiles, then resolves pcode → workshop from data.
CREATE OR REPLACE FUNCTION check_production_insert_permission(p_pcode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      TEXT;
  v_workspace TEXT;
  v_workshop  TEXT;
BEGIN
  -- Get the current user's role and workspace
  SELECT role, workspace
  INTO v_role, v_workspace
  FROM profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  -- ADMIN and MANAGER: unrestricted
  IF v_role IN ('ADMIN', 'MANAGER') THEN RETURN TRUE; END IF;

  -- Empty or ALL workspace: unrestricted (no factory filter set)
  IF v_workspace IS NULL OR v_workspace = '' OR upper(v_workspace) = 'ALL' THEN
    RETURN TRUE;
  END IF;

  -- Look up the workshop for this pcode from the data table (source of truth)
  SELECT "WORKSHOP" INTO v_workshop FROM data WHERE "PCODE" = p_pcode LIMIT 1;
  IF v_workshop IS NULL THEN RETURN FALSE; END IF;

  -- Map long workshop name → DMC code and check against user workspace list.
  -- Workspace field stores comma-separated DMC codes e.g. "DMC1,DMC3".
  RETURN (
    ((v_workshop ILIKE 'Phân xưởng 1%' OR v_workshop ILIKE 'Phân xưởng 2%' OR v_workshop = 'DMC1')
      AND v_workspace ILIKE '%DMC1%')
    OR ((v_workshop ILIKE 'Phân xưởng 3%' OR v_workshop = 'DMC3')
      AND v_workspace ILIKE '%DMC3%')
    OR ((v_workshop ILIKE 'Phân xưởng 4%' OR v_workshop = 'DMC4')
      AND v_workspace ILIKE '%DMC4%')
    OR ((v_workshop ILIKE 'Phân xưởng 5%' OR v_workshop = 'DMC5')
      AND v_workspace ILIKE '%DMC5%')
  );
END;
$$;

-- Drop the old permissive insert policy
DROP POLICY IF EXISTS "production_insert_authenticated" ON "Production";

-- New strict insert policy using the helper function
CREATE POLICY "production_insert_workshop_allowed" ON "Production"
  FOR INSERT TO authenticated
  WITH CHECK (
    check_production_insert_permission(pcode)
  );

-- SELECT and UPDATE remain as-is (server action controls read scope via getInitData).
-- ============================================================
