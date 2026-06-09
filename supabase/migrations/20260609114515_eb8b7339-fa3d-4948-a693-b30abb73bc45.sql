
-- Daily sales: shared read, master-only write
DROP POLICY IF EXISTS "own sales" ON public.daily_sales;
CREATE POLICY "auth read daily_sales" ON public.daily_sales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "master write daily_sales" ON public.daily_sales
  FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()));

-- Monthly goals: same model
DROP POLICY IF EXISTS "own goals" ON public.monthly_goals;
CREATE POLICY "auth read monthly_goals" ON public.monthly_goals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "master write monthly_goals" ON public.monthly_goals
  FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()));

-- Update handle_new_user: collaborators get broad read access
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_master boolean := NEW.email = 'loja@isoflex.com.br';
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF is_master THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin_master') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permissions (user_id, module)
      SELECT NEW.id, unnest(enum_range(NULL::public.app_module)) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permissions (user_id, module)
      SELECT NEW.id, m FROM unnest(ARRAY[
        'dashboard','lancamento','historico','metas','relatorio',
        'marketing','comercial','financeiro','rh','producao'
      ]::public.app_module[]) AS m
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: grant existing non-master users the same default modules
INSERT INTO public.user_permissions (user_id, module)
SELECT p.id, m
FROM public.profiles p
CROSS JOIN unnest(ARRAY[
  'dashboard','lancamento','historico','metas','relatorio',
  'marketing','comercial','financeiro','rh','producao'
]::public.app_module[]) AS m
WHERE NOT public.is_admin_master(p.id)
ON CONFLICT DO NOTHING;
