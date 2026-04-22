-- ============================================================
-- 004: Fix workspace bypass in Production RLS
-- Root cause: MANAGER role was treated as unrestricted (same as ADMIN).
-- Fix: only ADMIN bypasses workspace check.
-- MANAGER/SUPERVISOR/USER are all workspace-scoped.
-- Empty workspace ('') = deny for all non-ADMIN roles.
-- ============================================================

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
  SELECT role, workspace
  INTO v_role, v_workspace
  FROM profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  -- Only ADMIN is unrestricted
  IF v_role = 'ADMIN' THEN RETURN TRUE; END IF;

  -- Explicit ALL = unrestricted for any role
  IF upper(v_workspace) = 'ALL' THEN RETURN TRUE; END IF;

  -- Empty/NULL workspace = DENY for non-ADMIN
  -- Must explicitly set workspace ('DMC1,DMC3') or 'ALL'.
  IF v_workspace IS NULL OR v_workspace = '' THEN RETURN FALSE; END IF;

  -- Look up workshop from data table
  SELECT "WORKSHOP" INTO v_workshop FROM data WHERE "PCODE" = p_pcode LIMIT 1;
  IF v_workshop IS NULL THEN
    -- pcode not in data table (e.g. 'Việc khác' tasks: '5S', 'Đào tạo')
    RETURN TRUE;
  END IF;

  -- Check workshop against user's allowed workspace list
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

-- Drop old policies (handles cases where 003 was or wasn't applied)
DROP POLICY IF EXISTS "production_insert_authenticated" ON "Production";
DROP POLICY IF EXISTS "production_insert_workshop_allowed" ON "Production";

-- Strict insert policy
CREATE POLICY "production_insert_workshop_allowed" ON "Production"
  FOR INSERT TO authenticated
  WITH CHECK (
    check_production_insert_permission(pcode)
  );
