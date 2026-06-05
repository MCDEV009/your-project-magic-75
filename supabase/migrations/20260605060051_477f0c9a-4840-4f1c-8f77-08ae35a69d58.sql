
-- 1) Sunday-free flag on tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS is_sunday_free boolean NOT NULL DEFAULT false;

-- 2) Purchase function: bypass payment on Sunday when flag is set
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
  _wallet wallets;
  _txn wallet_transactions;
  _purchase test_purchases;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT visibility, COALESCE(is_sunday_free,false)
    INTO _visibility, _sunday_free
    FROM public.tests WHERE id = _test_id;
  IF _visibility IS NULL THEN
    RAISE EXCEPTION 'test_not_found';
  END IF;

  SELECT * INTO _purchase FROM public.test_purchases
    WHERE user_id = _user_id AND test_id = _test_id;
  IF FOUND THEN RETURN _purchase; END IF;

  -- Sunday free (UTC dow=0)
  IF _sunday_free AND EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Tashkent')) = 0 THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0)
      RETURNING * INTO _purchase;
    RETURN _purchase;
  END IF;

  IF get_user_plan(_user_id) = 'premium'::subscription_plan THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0)
      RETURNING * INTO _purchase;
    RETURN _purchase;
  END IF;

  IF _visibility <> 'paid'::test_visibility THEN
    INSERT INTO public.test_purchases (user_id, test_id, amount)
      VALUES (_user_id, _test_id, 0)
      RETURNING * INTO _purchase;
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
    VALUES (_user_id, _test_id, _txn.id, _price)
    RETURNING * INTO _purchase;
  RETURN _purchase;
END;
$function$;

-- 3) Rasch-weighted score recomputation
-- For each MCQ question correctly answered: points = max_points * (1 - p_correct)
-- where p_correct = correct_count / total_attempts in question_analytics (clamped 0.05..0.95)
-- Unknown questions → p=0.5 (neutral). Written score is added unchanged.
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
      COALESCE(qa.correct_count::numeric / NULLIF(qa.total_attempts,0), 0.5) AS p_raw
    FROM public.questions q
    LEFT JOIN public.question_analytics qa ON qa.question_id = q.id
    WHERE q.test_id = NEW.test_id AND q.question_type = 'single_choice'
  LOOP
    total_q := total_q + 1;
    IF ans ? q.id::text THEN
      BEGIN
        picked := (ans->>q.id::text)::int;
      EXCEPTION WHEN others THEN picked := -1; END;
      IF picked = q.correct_option THEN
        correct_n := correct_n + 1;
        p := LEAST(0.95, GREATEST(0.05, q.p_raw));
        earned := COALESCE(q.max_points,1) * (1 - p);
        mcq_total := mcq_total + earned;
      END IF;
    END IF;
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

DROP TRIGGER IF EXISTS trg_update_question_analytics ON public.test_attempts;
DROP TRIGGER IF EXISTS trg_apply_rasch_scoring_ins ON public.test_attempts;
DROP TRIGGER IF EXISTS trg_apply_rasch_scoring_upd ON public.test_attempts;
DROP TRIGGER IF EXISTS trg_update_qa_after ON public.test_attempts;

-- Rasch scoring runs BEFORE so it can mutate NEW.score
CREATE TRIGGER trg_apply_rasch_scoring_ins
  BEFORE INSERT ON public.test_attempts
  FOR EACH ROW
  WHEN (NEW.status = 'finished')
  EXECUTE FUNCTION public.apply_rasch_scoring();

CREATE TRIGGER trg_apply_rasch_scoring_upd
  BEFORE UPDATE OF status, written_score, ai_evaluation ON public.test_attempts
  FOR EACH ROW
  WHEN (NEW.status = 'finished')
  EXECUTE FUNCTION public.apply_rasch_scoring();

-- Analytics update runs AFTER (so future attempts use this attempt's data)
CREATE TRIGGER trg_update_qa_after
  AFTER INSERT OR UPDATE OF status ON public.test_attempts
  FOR EACH ROW
  WHEN (NEW.status = 'finished')
  EXECUTE FUNCTION public.update_question_analytics();
