DROP POLICY IF EXISTS "owners manage roles" ON public.user_roles;
CREATE POLICY "owners manage non-elevated roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) AND role NOT IN ('owner'::app_role, 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) AND role NOT IN ('owner'::app_role, 'admin'::app_role));
CREATE POLICY "service role manages all roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);