CREATE OR REPLACE VIEW public.v_data AS
SELECT
  id,
  "PCODE"        AS pcode,
  "WORKSHOP"     AS workshop,
  "CUSTOMER"     AS customer,
  "DESCRIPTION"  AS description,
  "QUANTITY"     AS quantity,
  "DEADLINEDATE" AS deadline_date,
  "INITIALDATE"  AS initial_date,
  "STATUS"       AS status,
  created_at,
  updated_at
FROM public.data;

GRANT SELECT ON public.v_data TO authenticated;
