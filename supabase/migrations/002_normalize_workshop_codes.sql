-- ============================================================
-- 002: Normalize Norm.workshop to DMC codes (OPTIONAL)
-- data.WORKSHOP is source of truth — NEVER modify it.
-- The application layer (normalizeWorkshop) handles long→short
-- conversion at runtime for the data table.
--
-- Run this ONLY if Norm.workshop also contains long names.
-- To verify first: SELECT DISTINCT workshop FROM "Norm" ORDER BY workshop;
-- ============================================================

UPDATE "Norm"
SET workshop = CASE
  WHEN workshop ILIKE 'Phân xưởng 1%' THEN 'DMC1'
  WHEN workshop ILIKE 'Phân xưởng 3%' THEN 'DMC3'
  WHEN workshop ILIKE 'Phân xưởng 4%' THEN 'DMC4'
  WHEN workshop ILIKE 'Phân xưởng 5%' THEN 'DMC5'
  ELSE workshop
END
WHERE workshop NOT IN ('DMC1', 'DMC3', 'DMC4', 'DMC5')
  AND workshop IS NOT NULL;

-- Verify:
-- SELECT DISTINCT workshop FROM "Norm" ORDER BY workshop;
-- Expected: only DMC1, DMC3, DMC4, DMC5
