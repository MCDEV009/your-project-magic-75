CREATE OR REPLACE FUNCTION public.purchase_plan_with_wallet(
  _plan public.subscription_plan,
  _billing text
)
RETURNS public.user_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _amount numeric;
  _months integer;
  _wallet public.wallets;
  _plan_row public.user_plans;
  _payment_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF _plan NOT IN ('pro'::public.subscription_plan, 'premium'::public.subscription_plan) THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;
  IF _billing NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'invalid_billing';
  END IF;

  _amount := CASE
    WHEN _plan = 'pro'::public.subscription_plan AND _billing = 'monthly' THEN 24000
    WHEN _plan = 'pro'::public.subscription_plan AND _billing = 'yearly' THEN 240000
    WHEN _plan = 'premium'::public.subscription_plan AND _billing = 'monthly' THEN 95000
    WHEN _plan = 'premium'::public.subscription_plan AND _billing = 'yearly' THEN 950000
  END;
  _months := CASE WHEN _billing = 'yearly' THEN 12 ELSE 1 END;

  PERFORM public.ensure_wallet(_user_id);
  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet.balance < _amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.wallets
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.plan_payments (user_id, plan, amount, currency, status, provider)
  VALUES (_user_id, _plan, _amount, _wallet.currency, 'paid', 'wallet')
  RETURNING id INTO _payment_id;

  INSERT INTO public.wallet_transactions
    (user_id, amount, currency, provider, status, type, metadata, paid_at)
  VALUES
    (_user_id, _amount, _wallet.currency, 'manual'::public.wallet_provider,
     'paid'::public.wallet_txn_status, 'spend'::public.wallet_txn_type,
     jsonb_build_object('kind', 'plan_purchase', 'plan', _plan, 'billing', _billing, 'payment_id', _payment_id), now());

  INSERT INTO public.user_plans (user_id, plan, started_at, expires_at, status)
  VALUES (_user_id, _plan, now(), now() + make_interval(months => _months), 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      started_at = now(),
      expires_at = CASE
        WHEN public.user_plans.status = 'active' AND public.user_plans.plan = EXCLUDED.plan AND public.user_plans.expires_at > now()
          THEN public.user_plans.expires_at + make_interval(months => _months)
        ELSE EXCLUDED.expires_at
      END,
      status = 'active',
      updated_at = now()
  RETURNING * INTO _plan_row;

  RETURN _plan_row;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_plan_with_wallet(public.subscription_plan, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_plan_with_wallet(public.subscription_plan, text) TO authenticated;