-- ============================================================
-- 048: Tách production-entry cho DMC3 (PU/PK/CT) và DMC4 (XG/PK) trong RLS,
--      đồng bộ với app-side (lib/production/workflow.ts). Giữ nguyên DMC1, DMC5
--      và mọi hành vi khác của 046; chỉ thêm nhánh split + workspace scoping cho DMC3/DMC4.
--   DMC3: 'pu' → DMC3-PU; 'phụ kiện'/'pk' → DMC3-PK; còn lại → DMC3-CT.
--   DMC4: 'xà gồ'/'xg' → DMC4-XG; 'phụ kiện'/'pk' → DMC4-PK; còn lại → DMC4-XG.
-- ============================================================

CREATE OR REPLACE FUNCTION check_production_insert_permission(p_pcode TEXT, p_totalem TEXT)
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
  v_is_internal_task BOOLEAN := FALSE;
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

  IF v_workshop IS NULL THEN
    IF p_pcode IN ('5S', 'Đào tạo', 'Hỗ trợ PX khác') THEN
      v_is_internal_task := TRUE;
      v_base_workshop := upper(coalesce(p_totalem, ''));
      IF v_base_workshop NOT IN ('DMC1', 'DMC3', 'DMC4', 'DMC5') THEN
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE;
    END IF;
  ELSIF v_workshop ILIKE 'Phân xưởng 1%' OR v_workshop ILIKE 'Phân xưởng 2%' OR upper(v_workshop) = 'DMC1' THEN
    v_base_workshop := 'DMC1';
    IF coalesce(v_description, '') ILIKE '%pu%' THEN
      v_entry_workshop := 'DMC1-PU';
    ELSIF coalesce(v_description, '') ILIKE '%phụ kiện%'
      OR coalesce(v_description, '') ILIKE '%pk%'
      OR coalesce(v_description, '') ILIKE '%tcs phẳng%' THEN
      v_entry_workshop := 'DMC1-PK';
    ELSE
      v_entry_workshop := 'DMC1-CT';
    END IF;
  ELSIF v_workshop ILIKE 'Phân xưởng 3%' OR upper(v_workshop) = 'DMC3' THEN
    v_base_workshop := 'DMC3';
    IF coalesce(v_description, '') ILIKE '%pu%' THEN
      v_entry_workshop := 'DMC3-PU';
    ELSIF coalesce(v_description, '') ILIKE '%phụ kiện%'
      OR coalesce(v_description, '') ILIKE '%pk%' THEN
      v_entry_workshop := 'DMC3-PK';
    ELSE
      v_entry_workshop := 'DMC3-CT';
    END IF;
  ELSIF v_workshop ILIKE 'Phân xưởng 4%' OR upper(v_workshop) = 'DMC4' THEN
    v_base_workshop := 'DMC4';
    IF coalesce(v_description, '') ILIKE '%xà gồ%'
      OR coalesce(v_description, '') ILIKE '%xg%' THEN
      v_entry_workshop := 'DMC4-XG';
    ELSIF coalesce(v_description, '') ILIKE '%phụ kiện%'
      OR coalesce(v_description, '') ILIKE '%pk%' THEN
      v_entry_workshop := 'DMC4-PK';
    ELSE
      v_entry_workshop := 'DMC4-XG';
    END IF;
  ELSIF v_workshop ILIKE 'Phân xưởng 5%' OR upper(v_workshop) = 'DMC5' THEN
    v_base_workshop := 'DMC5';
    v_entry_workshop := 'DMC5';
  ELSE
    RETURN FALSE;
  END IF;

  IF upper(coalesce(p_totalem, '')) <> v_base_workshop THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'ADMIN' THEN RETURN TRUE; END IF;
  IF upper(btrim(v_workspace)) = 'ALL' THEN RETURN TRUE; END IF;
  IF v_workspace IS NULL OR btrim(v_workspace) = '' THEN RETURN FALSE; END IF;

  v_workspaces := regexp_split_to_array(upper(regexp_replace(v_workspace, '\s+', '', 'g')), ',');

  IF v_base_workshop = 'DMC1' THEN
    IF v_is_internal_task THEN
      RETURN 'DMC1' = ANY(v_workspaces)
        OR 'DMC1-CT' = ANY(v_workspaces)
        OR 'DMC1-PK' = ANY(v_workspaces)
        OR 'DMC1-PU' = ANY(v_workspaces);
    END IF;

    RETURN 'DMC1' = ANY(v_workspaces) OR coalesce(v_entry_workshop, '') = ANY(v_workspaces);
  END IF;

  IF v_base_workshop = 'DMC3' THEN
    IF v_is_internal_task THEN
      RETURN 'DMC3' = ANY(v_workspaces)
        OR 'DMC3-CT' = ANY(v_workspaces)
        OR 'DMC3-PK' = ANY(v_workspaces)
        OR 'DMC3-PU' = ANY(v_workspaces);
    END IF;

    RETURN 'DMC3' = ANY(v_workspaces) OR coalesce(v_entry_workshop, '') = ANY(v_workspaces);
  END IF;

  IF v_base_workshop = 'DMC4' THEN
    IF v_is_internal_task THEN
      RETURN 'DMC4' = ANY(v_workspaces)
        OR 'DMC4-XG' = ANY(v_workspaces)
        OR 'DMC4-PK' = ANY(v_workspaces);
    END IF;

    RETURN 'DMC4' = ANY(v_workspaces) OR coalesce(v_entry_workshop, '') = ANY(v_workspaces);
  END IF;

  RETURN v_base_workshop = ANY(v_workspaces);
END;
$$;
