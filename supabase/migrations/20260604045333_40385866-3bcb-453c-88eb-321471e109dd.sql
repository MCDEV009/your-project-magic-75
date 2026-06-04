
-- 1) admin_audit_log: replace open insert with SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Anyone can insert audit entries" ON public.admin_audit_log;

CREATE OR REPLACE FUNCTION public.log_admin_audit(
  _route text,
  _required_roles text[],
  _granted boolean,
  _user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _route IS NULL OR length(_route) = 0 OR length(_route) > 500 THEN
    RAISE EXCEPTION 'invalid_route';
  END IF;
  INSERT INTO public.admin_audit_log (user_id, user_email, route, required_roles, granted, user_agent)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    _route,
    _required_roles,
    COALESCE(_granted, false),
    LEFT(COALESCE(_user_agent, ''), 500)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_audit(text, text[], boolean, text) TO anon, authenticated;

-- 2) questions: revoke column-level SELECT on sensitive columns for non-admins
REVOKE SELECT (correct_option, model_answer_uz, model_answer_ru, model_answer_en,
  rubric_uz, rubric_ru, points_a, points_b)
  ON public.questions FROM anon, authenticated;

-- 3) user_plans: drop self-insert privilege-escalation policy
DROP POLICY IF EXISTS "Users insert own plan" ON public.user_plans;

-- 4) Remove wallets and wallet_transactions from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallets;
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallet_transactions;

-- 5) Storage: remove public listing policy on question-images bucket
-- (direct public URLs still resolve via the storage CDN for public buckets)
DROP POLICY IF EXISTS "Question images are publicly viewable" ON storage.objects;
