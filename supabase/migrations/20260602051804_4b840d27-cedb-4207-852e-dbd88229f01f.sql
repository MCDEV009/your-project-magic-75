
CREATE TABLE public.test_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_id uuid NOT NULL,
  txn_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, test_id)
);

GRANT SELECT ON public.test_purchases TO authenticated;
GRANT ALL ON public.test_purchases TO service_role;

ALTER TABLE public.test_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
  ON public.test_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage purchases"
  ON public.test_purchases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Helper to check ownership
CREATE OR REPLACE FUNCTION public.user_has_purchased_test(_user_id uuid, _test_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.test_purchases
    WHERE user_id = _user_id AND test_id = _test_id
  );
$$;

-- Update INSERT policy on test_attempts to allow paid test if purchased or premium
DROP POLICY IF EXISTS "Create attempts respecting pricing" ON public.test_attempts;
CREATE POLICY "Create attempts respecting pricing"
  ON public.test_attempts FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tests t
      LEFT JOIN public.test_pricing tp ON tp.test_id = t.id
      WHERE t.id = test_attempts.test_id
        AND (
          t.visibility <> 'paid'::test_visibility
          OR tp.is_free IS TRUE
          OR (auth.uid() IS NOT NULL AND get_user_plan(auth.uid()) = 'premium'::subscription_plan)
          OR (auth.uid() IS NOT NULL AND public.user_has_purchased_test(auth.uid(), t.id))
        )
    )
  );

-- Purchase RPC: debits wallet and records purchase atomically
CREATE OR REPLACE FUNCTION public.purchase_test_with_wallet(_test_id uuid)
RETURNS public.test_purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _price numeric;
  _is_free boolean;
  _visibility test_visibility;
  _wallet wallets;
  _txn wallet_transactions;
  _purchase test_purchases;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT visibility INTO _visibility FROM public.tests WHERE id = _test_id;
  IF _visibility IS NULL THEN
    RAISE EXCEPTION 'test_not_found';
  END IF;

  -- Already purchased? idempotent
  SELECT * INTO _purchase FROM public.test_purchases
    WHERE user_id = _user_id AND test_id = _test_id;
  IF FOUND THEN
    RETURN _purchase;
  END IF;

  -- Premium users don't need to pay; just record a 0 purchase
  IF get_user_plan(_user_id) = 'premium'::subscription_plan THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0)
      RETURNING * INTO _purchase;
    RETURN _purchase;
  END IF;

  IF _visibility <> 'paid'::test_visibility THEN
    -- Free/public test, no purchase needed
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0)
      RETURNING * INTO _purchase;
    RETURN _purchase;
  END IF;

  SELECT price_uzs, is_free INTO _price, _is_free
    FROM public.test_pricing WHERE test_id = _test_id;
  IF _price IS NULL THEN _price := 10000; END IF;
  IF _is_free IS TRUE THEN _price := 0; END IF;

  -- Ensure wallet
  PERFORM public.ensure_wallet(_user_id);

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;

  IF _wallet.balance < _price THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.wallets
    SET balance = balance - _price, updated_at = now()
    WHERE user_id = _user_id;

  INSERT INTO public.wallet_transactions
    (user_id, amount, currency, provider, status, type, metadata, paid_at)
    VALUES (
      _user_id, _price, _wallet.currency, 'payme'::wallet_provider,
      'paid'::wallet_txn_status, 'spend'::wallet_txn_type,
      jsonb_build_object('test_id', _test_id, 'kind', 'test_purchase'),
      now()
    )
    RETURNING * INTO _txn;

  INSERT INTO public.test_purchases (user_id, test_id, txn_id, amount)
    VALUES (_user_id, _test_id, _txn.id, _price)
    RETURNING * INTO _purchase;

  RETURN _purchase;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_test_with_wallet(uuid) TO authenticated;
