
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  image_url text,
  price numeric(12,2) DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_all" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin_master(auth.uid()));
CREATE POLICY "products_admin_update" ON public.products FOR UPDATE TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE POLICY "products_admin_delete" ON public.products FOR DELETE TO authenticated USING (public.is_admin_master(auth.uid()));
CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.product_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_date date NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  total_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_sales_date ON public.product_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_product_sales_product ON public.product_sales(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sales TO authenticated;
GRANT ALL ON public.product_sales TO service_role;
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_sales_select_all" ON public.product_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_sales_admin_insert" ON public.product_sales FOR INSERT TO authenticated WITH CHECK (public.is_admin_master(auth.uid()));
CREATE POLICY "product_sales_admin_update" ON public.product_sales FOR UPDATE TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE POLICY "product_sales_admin_delete" ON public.product_sales FOR DELETE TO authenticated USING (public.is_admin_master(auth.uid()));
CREATE TRIGGER product_sales_touch_updated_at BEFORE UPDATE ON public.product_sales FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE is_master boolean := NEW.email = 'loja@isoflex.com.br';
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  IF is_master THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin_master') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permissions (user_id, module) SELECT NEW.id, unnest(enum_range(NULL::public.app_module)) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permissions (user_id, module)
      SELECT NEW.id, m FROM unnest(ARRAY['dashboard','lancamento','historico','metas','relatorio','marketing','comercial','financeiro','rh','producao','top_produtos']::public.app_module[]) AS m
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO public.user_permissions (user_id, module)
SELECT p.id, 'top_produtos'::public.app_module FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = p.id AND up.module = 'top_produtos')
ON CONFLICT DO NOTHING;
