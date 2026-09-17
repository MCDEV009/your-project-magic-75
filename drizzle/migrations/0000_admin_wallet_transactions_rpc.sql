CREATE OR REPLACE FUNCTION public.admin_wallet_transactions(_status text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  username text,
  amount numeric,
  currency text,
  provider wallet_provider,
  provider_txn_id text,
  status wallet_txn_status,
  type wallet_txn_type,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.user_id, u.email::text, p.full_name, p.username,
         t.amount, t.currency, t.provider, t.provider_txn_id, t.status, t.type,
         t.metadata, t.paid_at, t.created_at
  FROM public.wallet_transactions t
  LEFT JOIN auth.users u ON u.id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND (_status IS NULL OR t.status::text = _status)
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.admin_wallet_transactions(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_wallet_transactions(text, integer) TO authenticated;