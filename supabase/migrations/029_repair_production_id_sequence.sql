CREATE OR REPLACE FUNCTION public.repair_production_id_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM setval(
    pg_get_serial_sequence('"Production"', 'id'),
    COALESCE((SELECT MAX(id) FROM public."Production"), 0) + 1,
    false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_production_id_sequence() TO authenticated;

SELECT public.repair_production_id_sequence();
