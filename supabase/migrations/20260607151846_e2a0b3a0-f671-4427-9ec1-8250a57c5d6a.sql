
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin_master', 'gestor', 'colaborador');
CREATE TYPE public.app_module AS ENUM (
  'dashboard','lancamento','historico','metas','relatorio',
  'marketing','comercial','financeiro','rh','producao','configuracoes','usuarios'
);
CREATE TYPE public.user_status AS ENUM ('ativo','inativo','bloqueado');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text,
  cargo text,
  setor text,
  avatar_url text,
  status public.user_status NOT NULL DEFAULT 'ativo',
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============= USER PERMISSIONS =============
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ============= AUDIT LOG =============
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity text,
  entity_id text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============= SECURITY DEFINER FUNCTIONS =============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin_master')
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module public.app_module)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_master(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND module = _module)
$$;

-- ============= RLS POLICIES =============
-- profiles
CREATE POLICY "profiles self select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin_master(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin_master(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin_master(auth.uid()));
CREATE POLICY "profiles admin insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_master(auth.uid()) OR auth.uid() = id);
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin_master(auth.uid()));

-- user_roles
CREATE POLICY "roles self select" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_master(auth.uid()));
CREATE POLICY "roles admin all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()));

-- user_permissions
CREATE POLICY "perms self select" ON public.user_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_master(auth.uid()));
CREATE POLICY "perms admin all" ON public.user_permissions FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()));

-- audit_log
CREATE POLICY "audit admin select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin_master(auth.uid()));
CREATE POLICY "audit insert self" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- ============= TRIGGERS =============
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile + default role/permissions when a new auth.users row appears
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_master boolean := NEW.email = 'loja@isoflex.com.br';
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF is_master THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin_master')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permissions (user_id, module)
      SELECT NEW.id, unnest(enum_range(NULL::public.app_module))
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'colaborador')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permissions (user_id, module) VALUES (NEW.id, 'dashboard')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= BACKFILL EXISTING USERS =============
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Promote loja@isoflex.com.br to admin_master with all permissions
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin_master' FROM auth.users WHERE email = 'loja@isoflex.com.br'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, module)
SELECT u.id, m
FROM auth.users u
CROSS JOIN unnest(enum_range(NULL::public.app_module)) AS m
WHERE u.email = 'loja@isoflex.com.br'
ON CONFLICT DO NOTHING;

-- Everyone else gets at least 'colaborador' + dashboard
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'colaborador'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, module)
SELECT u.id, 'dashboard'::public.app_module
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions p WHERE p.user_id = u.id AND p.module = 'dashboard'
)
ON CONFLICT DO NOTHING;
