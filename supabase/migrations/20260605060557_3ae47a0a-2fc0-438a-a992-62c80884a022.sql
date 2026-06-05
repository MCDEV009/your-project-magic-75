
-- 1) Audit jadval: yakshanba bepul foydalanish loglari
CREATE TABLE IF NOT EXISTS public.sunday_free_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  weekday_tashkent int NOT NULL
);
GRANT SELECT, INSERT ON public.sunday_free_redemptions TO authenticated;
GRANT ALL ON public.sunday_free_redemptions TO service_role;
ALTER TABLE public.sunday_free_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own sunday redemptions"
  ON public.sunday_free_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins read all redemptions"
  ON public.sunday_free_redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Per-question stored Rasch points so the UI can display them
ALTER TABLE public.question_analyses
  ADD COLUMN IF NOT EXISTS rasch_points numeric,
  ADD COLUMN IF NOT EXISTS p_correct numeric;

-- 2) Rasch ballash + per-question yozish + barqaror fallback (Bayes shrinkage)
--    p_smoothed = (correct + 2) / (total + 4)   -> prior=0.5, kuch=4
--    p clamp [0.05..0.95]
CREATE OR REPLACE FUNCTION public.apply_rasch_scoring()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q record;
  ans jsonb;
  picked int;
  p numeric;
  earned numeric;
  mcq_total numeric := 0;
  correct_n int := 0;
  total_q int := 0;
BEGIN
  IF NEW.status <> 'finished' THEN RETURN NEW; END IF;

  ans := COALESCE(NEW.answers, '{}'::jsonb);

  FOR q IN
    SELECT q.id, q.correct_option, q.max_points,
      -- Bayesian shrinkage: prior 0.5, virtual sample size 4
      ((COALESCE(qa.correct_count,0)::numeric + 2)
        / (COALESCE(qa.total_attempts,0)::numeric + 4)) AS p_smoothed
    FROM public.questions q
    LEFT JOIN public.question_analytics qa ON qa.question_id = q.id
    WHERE q.test_id = NEW.test_id AND q.question_type = 'single_choice'
  LOOP
    total_q := total_q + 1;
    p := LEAST(0.95, GREATEST(0.05, q.p_smoothed));
    earned := 0;

    IF ans ? q.id::text THEN
      BEGIN
        picked := (ans->>q.id::text)::int;
      EXCEPTION WHEN others THEN picked := -1; END;
      IF picked = q.correct_option THEN
        correct_n := correct_n + 1;
        earned := COALESCE(q.max_points,1) * (1 - p);
      END IF;
    END IF;

    -- Upsert per-question record so Results UI can show it
    INSERT INTO public.question_analyses
      (attempt_id, question_id, question_type, is_correct,
       points_earned, max_points, rasch_points, p_correct)
    VALUES
      (NEW.id, q.id, 'single_choice',
       (ans ? q.id::text) AND earned > 0,
       earned, COALESCE(q.max_points,1), earned, p)
    ON CONFLICT (attempt_id, question_id) DO UPDATE SET
       question_type = 'single_choice',
       is_correct    = EXCLUDED.is_correct,
       points_earned = EXCLUDED.points_earned,
       max_points    = EXCLUDED.max_points,
       rasch_points  = EXCLUDED.rasch_points,
       p_correct     = EXCLUDED.p_correct;

    mcq_total := mcq_total + earned;
  END LOOP;

  NEW.mcq_score := ROUND(mcq_total::numeric, 2);
  NEW.correct_answers := correct_n;
  IF NEW.total_questions IS NULL OR NEW.total_questions = 0 THEN
    NEW.total_questions := total_q;
  END IF;
  NEW.score := ROUND((COALESCE(NEW.mcq_score,0) + COALESCE(NEW.written_score,0))::numeric, 2);
  RETURN NEW;
END;
$function$;

-- Unique index needed for ON CONFLICT above (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS question_analyses_attempt_question_uniq
  ON public.question_analyses (attempt_id, question_id);

-- 3) Purchase function: log Sunday-free redemptions
CREATE OR REPLACE FUNCTION public.purchase_test_with_wallet(_test_id uuid)
 RETURNS test_purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _price numeric;
  _is_free boolean;
  _visibility test_visibility;
  _sunday_free boolean;
  _dow int;
  _wallet wallets;
  _txn wallet_transactions;
  _purchase test_purchases;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT visibility, COALESCE(is_sunday_free,false)
    INTO _visibility, _sunday_free
    FROM public.tests WHERE id = _test_id;
  IF _visibility IS NULL THEN RAISE EXCEPTION 'test_not_found'; END IF;

  SELECT * INTO _purchase FROM public.test_purchases
    WHERE user_id = _user_id AND test_id = _test_id;
  IF FOUND THEN RETURN _purchase; END IF;

  _dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Tashkent'))::int;

  IF _sunday_free AND _dow = 0 THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0) RETURNING * INTO _purchase;
    INSERT INTO public.sunday_free_redemptions (user_id, test_id, weekday_tashkent)
      VALUES (_user_id, _test_id, _dow);
    RETURN _purchase;
  END IF;

  IF get_user_plan(_user_id) = 'premium'::subscription_plan THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0) RETURNING * INTO _purchase;
    RETURN _purchase;
  END IF;

  IF _visibility <> 'paid'::test_visibility THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0) RETURNING * INTO _purchase;
    RETURN _purchase;
  END IF;

  SELECT price_uzs, is_free INTO _price, _is_free
    FROM public.test_pricing WHERE test_id = _test_id;
  IF _price IS NULL THEN _price := 10000; END IF;
  IF _is_free IS TRUE THEN _price := 0; END IF;

  PERFORM public.ensure_wallet(_user_id);
  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet.balance < _price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.wallet_transactions
    (user_id, amount, currency, provider, status, type, metadata, paid_at)
    VALUES (_user_id, _price, _wallet.currency, 'payme'::wallet_provider,
      'paid'::wallet_txn_status, 'spend'::wallet_txn_type,
      jsonb_build_object('test_id', _test_id, 'kind', 'test_purchase'), now())
    RETURNING * INTO _txn;

  INSERT INTO public.test_purchases (user_id, test_id, txn_id, amount)
    VALUES (_user_id, _test_id, _txn.id, _price) RETURNING * INTO _purchase;
  RETURN _purchase;
END;
$function$;

-- 4) Mini-analytics RPC: per-test stats for admin
CREATE OR REPLACE FUNCTION public.admin_test_stats()
 RETURNS TABLE(
   test_id uuid,
   title text,
   attempts int,
   unique_participants int,
   avg_score numeric,
   sunday_redemptions int,
   is_sunday_free boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    t.id AS test_id,
    t.title_uz AS title,
    COALESCE(a.attempts,0)::int,
    COALESCE(a.unique_participants,0)::int,
    ROUND(COALESCE(a.avg_score,0)::numeric, 2) AS avg_score,
    COALESCE(s.redemptions,0)::int AS sunday_redemptions,
    COALESCE(t.is_sunday_free,false) AS is_sunday_free
  FROM public.tests t
  LEFT JOIN (
    SELECT test_id,
      COUNT(*)            AS attempts,
      COUNT(DISTINCT participant_id) AS unique_participants,
      AVG(NULLIF(score,0)) AS avg_score
    FROM public.test_attempts
    WHERE status = 'finished'
    GROUP BY test_id
  ) a ON a.test_id = t.id
  LEFT JOIN (
    SELECT test_id, COUNT(*) AS redemptions
    FROM public.sunday_free_redemptions
    GROUP BY test_id
  ) s ON s.test_id = t.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY a.attempts DESC NULLS LAST, t.created_at DESC;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_test_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_test_stats() TO authenticated;
