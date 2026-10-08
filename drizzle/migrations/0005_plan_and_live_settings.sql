CREATE TABLE public.plan_settings (
  plan public.subscription_plan PRIMARY KEY,
  monthly_price numeric NOT NULL DEFAULT 0,
  yearly_price numeric NOT NULL DEFAULT 0,
  mocks_limit integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.plan_settings TO authenticated;
GRANT ALL ON public.plan_settings TO service_role;
ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads plan settings" ON public.plan_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage plan settings" ON public.plan_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.plan_settings (plan, monthly_price, yearly_price, mocks_limit) VALUES
 ('free',0,0,1),('pro',24000,240000,5),('premium',95000,950000,25);

CREATE TABLE public.live_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_duration_minutes integer NOT NULL DEFAULT 90 CHECK (default_duration_minutes BETWEEN 5 AND 300),
  auto_delete_enabled boolean NOT NULL DEFAULT true,
  retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.live_settings TO authenticated;
GRANT ALL ON public.live_settings TO service_role;
ALTER TABLE public.live_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read live settings" ON public.live_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "Admins manage live settings" ON public.live_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.live_settings DEFAULT VALUES;

CREATE OR REPLACE FUNCTION public.cleanup_old_live_sessions(_force boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.live_settings; _ids uuid[]; _n integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _s FROM public.live_settings WHERE id;
  IF _s IS NULL OR (NOT _s.auto_delete_enabled AND NOT _force) THEN RETURN 0; END IF;
  SELECT array_agg(id) INTO _ids FROM public.live_sessions
   WHERE coalesce(ends_at, starts_at + make_interval(secs => duration_seconds)) < now() - make_interval(days => _s.retention_days);
  IF _ids IS NULL THEN RETURN 0; END IF;
  UPDATE public.test_attempts SET session_id = NULL WHERE session_id = ANY(_ids);
  DELETE FROM public.live_participants WHERE session_id = ANY(_ids);
  DELETE FROM public.live_sessions WHERE id = ANY(_ids);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_old_live_sessions(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_live_sessions(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_users_overview(_search text DEFAULT NULL, _limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, email text, full_name text, username text, balance numeric, plan public.subscription_plan, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.username, coalesce(w.balance,0), coalesce(up.plan,'free'::public.subscription_plan), up.expires_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.wallets w ON w.user_id = u.id
  LEFT JOIN public.user_plans up ON up.user_id = u.id AND up.status = 'active'
  WHERE _search IS NULL OR _search = '' OR u.email ILIKE '%'||_search||'%' OR p.full_name ILIKE '%'||_search||'%' OR p.username ILIKE '%'||_search||'%'
  ORDER BY u.created_at DESC LIMIT least(greatest(_limit,1),200);
END $$;
REVOKE ALL ON FUNCTION public.admin_users_overview(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_overview(text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_user_id uuid, _plan public.subscription_plan, _months integer DEFAULT 1)
RETURNS public.user_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.user_plans;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.user_plans (user_id, plan, started_at, expires_at, status)
  VALUES (_user_id, _plan, now(), CASE WHEN _plan = 'free' OR _months IS NULL OR _months <= 0 THEN NULL ELSE now() + make_interval(months => _months) END, 'active')
  ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, started_at = now(), expires_at = EXCLUDED.expires_at, status = 'active', updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_user_plan(uuid, public.subscription_plan, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, public.subscription_plan, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_plan_with_wallet(_plan public.subscription_plan, _billing text)
RETURNS public.user_plans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid := auth.uid(); _amount numeric; _months integer;
  _wallet public.wallets; _plan_row public.user_plans; _payment_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _plan NOT IN ('pro','premium') THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  IF _billing NOT IN ('monthly','yearly') THEN RAISE EXCEPTION 'invalid_billing'; END IF;
  SELECT CASE WHEN _billing = 'yearly' THEN yearly_price ELSE monthly_price END INTO _amount
    FROM public.plan_settings WHERE plan = _plan;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  _months := CASE WHEN _billing = 'yearly' THEN 12 ELSE 1 END;
  PERFORM public.ensure_wallet(_user_id);
  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet.balance < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.plan_payments (user_id, plan, amount, currency, status, provider)
  VALUES (_user_id, _plan, _amount, _wallet.currency, 'paid', 'wallet') RETURNING id INTO _payment_id;
  INSERT INTO public.wallet_transactions (user_id, amount, currency, provider, status, type, metadata, paid_at)
  VALUES (_user_id, _amount, _wallet.currency, 'manual', 'paid', 'spend',
    jsonb_build_object('kind','plan_purchase','plan',_plan,'billing',_billing,'payment_id',_payment_id), now());
  INSERT INTO public.user_plans (user_id, plan, started_at, expires_at, status)
  VALUES (_user_id, _plan, now(), now() + make_interval(months => _months), 'active')
  ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, started_at = now(),
    expires_at = CASE WHEN public.user_plans.status = 'active' AND public.user_plans.plan = EXCLUDED.plan AND public.user_plans.expires_at > now()
      THEN public.user_plans.expires_at + make_interval(months => _months) ELSE EXCLUDED.expires_at END,
    status = 'active', updated_at = now()
  RETURNING * INTO _plan_row;
  RETURN _plan_row;
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('cleanup-old-live-sessions', '15 3 * * *', 'SELECT public.cleanup_old_live_sessions(false)');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron unavailable: %', SQLERRM;
END $$;