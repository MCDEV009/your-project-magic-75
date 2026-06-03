-- Allow authenticated users to create their own pending top-up transactions
CREATE POLICY "Users create own pending topups"
  ON public.wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'::wallet_txn_status
    AND type = 'topup'::wallet_txn_type
  );

-- Lock down direct UPDATEs by users (only admins/RPC may move statuses)
-- (No UPDATE policy for `authenticated` exists; admin ALL policy already covers admin paths.
--  RPC `credit_wallet_for_transaction` runs SECURITY DEFINER and bypasses RLS.)

-- Enable realtime so the wallet page reflects status changes pushed by webhooks
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;