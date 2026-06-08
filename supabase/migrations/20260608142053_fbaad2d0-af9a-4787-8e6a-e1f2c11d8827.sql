
-- 1) login_attempts
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_time_idx ON public.login_attempts (email, attempted_at DESC);

GRANT ALL ON public.login_attempts TO service_role;
-- nenhum acesso direto para anon/authenticated; tudo via RPC SECURITY DEFINER
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.login_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) check lock
CREATE OR REPLACE FUNCTION public.check_login_lock(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_fails int;
  last_fail timestamptz;
  lock_until timestamptz;
  max_attempts constant int := 5;
  window_minutes constant int := 15;
  lock_minutes constant int := 15;
BEGIN
  SELECT count(*) FILTER (WHERE success = false),
         max(attempted_at) FILTER (WHERE success = false)
    INTO recent_fails, last_fail
    FROM public.login_attempts
   WHERE lower(email) = lower(_email)
     AND attempted_at > now() - (window_minutes || ' minutes')::interval
     AND NOT EXISTS (
       SELECT 1 FROM public.login_attempts la2
        WHERE lower(la2.email) = lower(_email)
          AND la2.success = true
          AND la2.attempted_at > public.login_attempts.attempted_at
     );

  IF recent_fails >= max_attempts THEN
    lock_until := last_fail + (lock_minutes || ' minutes')::interval;
    IF lock_until > now() THEN
      RETURN jsonb_build_object(
        'locked', true,
        'locked_until', lock_until,
        'attempts_remaining', 0
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'attempts_remaining', greatest(max_attempts - coalesce(recent_fails, 0), 0)
  );
END;
$$;

-- 3) record attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(_email text, _ip text, _ua text, _success boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, user_agent, success)
  VALUES (_email, _ip, _ua, _success);

  IF _success THEN
    SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
    IF _uid IS NOT NULL THEN
      UPDATE public.profiles SET last_login = now() WHERE id = _uid;
      INSERT INTO public.audit_log(actor_id, actor_email, action, entity, ip_address, user_agent, details)
        VALUES (_uid, _email, 'auth.login', 'auth', _ip, _ua, jsonb_build_object('success', true));
    END IF;
  ELSE
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, ip_address, user_agent, details)
      VALUES (NULL, _email, 'auth.login_failed', 'auth', _ip, _ua, jsonb_build_object('success', false));
  END IF;

  RETURN public.check_login_lock(_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_lock(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, text, text, boolean) TO anon, authenticated, service_role;
