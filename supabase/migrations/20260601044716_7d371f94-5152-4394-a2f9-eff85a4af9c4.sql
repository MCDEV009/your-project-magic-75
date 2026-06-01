-- ============================================================
-- WALLETS
-- ============================================================
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'UZS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet"
  ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage wallets"
  ON public.wallets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- WALLET TRANSACTIONS
-- ============================================================
CREATE TYPE public.wallet_provider AS ENUM ('payme', 'click', 'manual');
CREATE TYPE public.wallet_txn_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE public.wallet_txn_type AS ENUM ('topup', 'spend', 'refund', 'adjustment');

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UZS',
  provider wallet_provider NOT NULL,
  provider_txn_id text,
  status wallet_txn_status NOT NULL DEFAULT 'pending',
  type wallet_txn_type NOT NULL DEFAULT 'topup',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One external txn id per provider (prevents duplicate credits)
CREATE UNIQUE INDEX wallet_tx_provider_extid_uidx
  ON public.wallet_transactions (provider, provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions (user_id, created_at DESC);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage transactions"
  ON public.wallet_transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_wallet_tx_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Auto-create wallet row helper (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE w public.wallets;
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id;
  RETURN w;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO authenticated, service_role;

-- ============================================================
-- Atomic credit: idempotent, only credits a pending txn once
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_wallet_for_transaction(
  _txn_id uuid,
  _provider_txn_id text DEFAULT NULL
)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.wallet_transactions;
BEGIN
  SELECT * INTO t FROM public.wallet_transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found';
  END IF;

  -- Idempotent: already paid → just return it
  IF t.status = 'paid' THEN
    RETURN t;
  END IF;

  IF t.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'transaction_not_pending: %', t.status;
  END IF;

  -- Ensure wallet exists
  PERFORM public.ensure_wallet(t.user_id);

  UPDATE public.wallets
    SET balance = balance + t.amount,
        updated_at = now()
    WHERE user_id = t.user_id;

  UPDATE public.wallet_transactions
    SET status = 'paid',
        paid_at = now(),
        provider_txn_id = COALESCE(_provider_txn_id, provider_txn_id),
        updated_at = now()
    WHERE id = t.id
    RETURNING * INTO t;

  RETURN t;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet_for_transaction(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_for_transaction(uuid, text) TO service_role;

-- ============================================================
-- Cancel transaction (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_wallet_transaction(_txn_id uuid, _reason text DEFAULT NULL)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t public.wallet_transactions;
BEGIN
  SELECT * INTO t FROM public.wallet_transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  IF t.status = 'paid' THEN
    -- Refund path: debit wallet then mark refunded
    UPDATE public.wallets SET balance = GREATEST(0, balance - t.amount), updated_at = now()
      WHERE user_id = t.user_id;
    UPDATE public.wallet_transactions
      SET status = 'refunded',
          metadata = metadata || jsonb_build_object('cancel_reason', _reason),
          updated_at = now()
      WHERE id = t.id RETURNING * INTO t;
    RETURN t;
  END IF;

  IF t.status IN ('cancelled', 'failed', 'refunded') THEN
    RETURN t;
  END IF;

  UPDATE public.wallet_transactions
    SET status = 'cancelled',
        metadata = metadata || jsonb_build_object('cancel_reason', _reason),
        updated_at = now()
    WHERE id = t.id RETURNING * INTO t;
  RETURN t;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_wallet_transaction(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_wallet_transaction(uuid, text) TO service_role;