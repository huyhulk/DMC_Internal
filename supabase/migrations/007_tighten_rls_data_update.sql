DROP POLICY IF EXISTS "data_update_all" ON public.data;

CREATE POLICY "data_update_admin_manager"
  ON public.data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "data_update_supervisor_own_workshop"
  ON public.data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'SUPERVISOR'
      AND p.workspace = data."WORKSHOP"
    )
  );
