-- 1. Payment settings (card transfer)
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  card_number text NOT NULL DEFAULT '0000 0000 0000 0000',
  card_holder text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.payment_settings TO anon, authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_settings_read" ON public.payment_settings;
CREATE POLICY "payment_settings_read" ON public.payment_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "payment_settings_admin_write" ON public.payment_settings;
CREATE POLICY "payment_settings_admin_write" ON public.payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
GRANT INSERT, UPDATE ON public.payment_settings TO authenticated;
INSERT INTO public.payment_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
CREATE TRIGGER trg_payment_settings_updated BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Trigger error audit log
CREATE TABLE IF NOT EXISTS public.trigger_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  attempt_id uuid,
  test_id uuid,
  sqlstate text,
  message text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trigger_error_log TO authenticated;
GRANT ALL ON public.trigger_error_log TO service_role;
ALTER TABLE public.trigger_error_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trigger_error_log_admin_read" ON public.trigger_error_log;
CREATE POLICY "trigger_error_log_admin_read" ON public.trigger_error_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_trigger_error_log_created ON public.trigger_error_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_trigger_error(
  _source text, _attempt_id uuid, _test_id uuid, _sqlstate text, _message text, _detail text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.trigger_error_log (source, attempt_id, test_id, sqlstate, message, detail)
  VALUES (_source, _attempt_id, _test_id, _sqlstate, left(coalesce(_message,''), 2000), left(coalesce(_detail,''), 2000));
EXCEPTION WHEN others THEN
  NULL;
END; $$;

-- 3. Idempotency ledger for analytics
CREATE TABLE IF NOT EXISTS public.attempt_analytics_applied (
  attempt_id uuid PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.attempt_analytics_applied TO authenticated;
GRANT ALL ON public.attempt_analytics_applied TO service_role;
ALTER TABLE public.attempt_analytics_applied ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attempt_analytics_applied_admin_read" ON public.attempt_analytics_applied;
CREATE POLICY "attempt_analytics_applied_admin_read" ON public.attempt_analytics_applied FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- backfill so existing finished attempts are never re-counted
INSERT INTO public.attempt_analytics_applied (attempt_id)
SELECT id FROM public.test_attempts WHERE status = 'finished'
ON CONFLICT DO NOTHING;

-- 4. Analytics trigger: idempotent + error logged
CREATE OR REPLACE FUNCTION public.update_question_analytics()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  q_id uuid;
  q_correct integer;
  ans jsonb;
  claimed boolean := false;
BEGIN
  IF NEW.status <> 'finished' THEN RETURN NEW; END IF;

  -- Idempotency guard: only the first successful claim processes analytics
  INSERT INTO public.attempt_analytics_applied (attempt_id)
  VALUES (NEW.id)
  ON CONFLICT (attempt_id) DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF NOT claimed THEN RETURN NEW; END IF;

  BEGIN
    ans := COALESCE(NEW.answers, '{}'::jsonb);

    FOR q_id, q_correct IN
      SELECT q.id, q.correct_option FROM public.questions q
      WHERE q.test_id = NEW.test_id AND q.question_type = 'single_choice'
    LOOP
      INSERT INTO public.question_analytics (question_id, test_id, total_attempts, correct_count, incorrect_count, skipped_count, difficulty_score)
      VALUES (
        q_id, NEW.test_id, 1,
        CASE WHEN (ans->>q_id::text) IS NOT NULL AND (ans->>q_id::text) ~ '^-?\d+$' AND (ans->>q_id::text)::integer = q_correct THEN 1 ELSE 0 END,
        CASE WHEN ans ? q_id::text AND ((ans->>q_id::text) !~ '^-?\d+$' OR (ans->>q_id::text)::integer <> q_correct) THEN 1 ELSE 0 END,
        CASE WHEN NOT ans ? q_id::text THEN 1 ELSE 0 END,
        0.5
      )
      ON CONFLICT (question_id) DO UPDATE SET
        total_attempts = public.question_analytics.total_attempts + 1,
        correct_count = public.question_analytics.correct_count
          + CASE WHEN (ans->>q_id::text) IS NOT NULL AND (ans->>q_id::text) ~ '^-?\d+$' AND (ans->>q_id::text)::integer = q_correct THEN 1 ELSE 0 END,
        incorrect_count = public.question_analytics.incorrect_count
          + CASE WHEN ans ? q_id::text AND ((ans->>q_id::text) !~ '^-?\d+$' OR (ans->>q_id::text)::integer <> q_correct) THEN 1 ELSE 0 END,
        skipped_count = public.question_analytics.skipped_count + CASE WHEN NOT ans ? q_id::text THEN 1 ELSE 0 END,
        difficulty_score = CASE
          WHEN (public.question_analytics.total_attempts + 1) > 0
          THEN 1.0 - (public.question_analytics.correct_count
            + CASE WHEN (ans->>q_id::text) IS NOT NULL AND (ans->>q_id::text) ~ '^-?\d+$' AND (ans->>q_id::text)::integer = q_correct THEN 1 ELSE 0 END)::numeric
            / (public.question_analytics.total_attempts + 1)
          ELSE 0.5 END,
        updated_at = now();
    END LOOP;

    INSERT INTO public.student_rankings (participant_id, full_name, total_tests, total_score, avg_score, best_score, last_test_at)
    SELECT
      NEW.participant_id,
      COALESCE((SELECT tp.full_name FROM public.test_participants tp WHERE tp.participant_id = NEW.participant_id LIMIT 1), 'Unknown'),
      1, COALESCE(NEW.score, 0), COALESCE(NEW.score, 0), COALESCE(NEW.score, 0), now()
    ON CONFLICT (participant_id) DO UPDATE SET
      total_tests = public.student_rankings.total_tests + 1,
      total_score = public.student_rankings.total_score + COALESCE(NEW.score, 0),
      avg_score = (public.student_rankings.total_score + COALESCE(NEW.score, 0)) / (public.student_rankings.total_tests + 1),
      best_score = GREATEST(public.student_rankings.best_score, COALESCE(NEW.score, 0)),
      full_name = COALESCE((SELECT tp.full_name FROM public.test_participants tp WHERE tp.participant_id = NEW.participant_id LIMIT 1), public.student_rankings.full_name),
      last_test_at = now(),
      updated_at = now();
  EXCEPTION WHEN others THEN
    PERFORM public.log_trigger_error('update_question_analytics', NEW.id, NEW.test_id, SQLSTATE, SQLERRM, NULL);
  END;

  RETURN NEW;
END;
$function$;

-- 5. Rasch trigger: wrap in error logging
CREATE OR REPLACE FUNCTION public.apply_rasch_scoring()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  ans jsonb;
  picked int;
  p numeric;
  earned numeric;
  mcq_total numeric := 0;
  correct_n int := 0;
  total_q int := 0;
  s_prior_mean numeric := 0.5;
  s_prior_strength numeric := 4;
  s_pmin numeric := 0.05;
  s_pmax numeric := 0.95;
BEGIN
  IF NEW.status <> 'finished' THEN RETURN NEW; END IF;

  BEGIN
    SELECT prior_mean, prior_strength, p_min, p_max
      INTO s_prior_mean, s_prior_strength, s_pmin, s_pmax
      FROM public.rasch_settings WHERE id = true;
    s_prior_mean := COALESCE(s_prior_mean, 0.5);
    s_prior_strength := COALESCE(s_prior_strength, 4);
    s_pmin := COALESCE(s_pmin, 0.05);
    s_pmax := COALESCE(s_pmax, 0.95);

    ans := COALESCE(NEW.answers, '{}'::jsonb);

    FOR rec IN
      SELECT q.id AS qid, q.correct_option AS correct_option, COALESCE(q.max_points,1) AS max_points,
        ((COALESCE(qa.correct_count,0)::numeric + (s_prior_mean * s_prior_strength))
          / (COALESCE(qa.total_attempts,0)::numeric + s_prior_strength)) AS p_smoothed
      FROM public.questions q
      LEFT JOIN public.question_analytics qa ON qa.question_id = q.id
      WHERE q.test_id = NEW.test_id AND q.question_type = 'single_choice'
    LOOP
      total_q := total_q + 1;
      p := LEAST(s_pmax, GREATEST(s_pmin, rec.p_smoothed));
      earned := 0;
      IF ans ? rec.qid::text THEN
        BEGIN picked := (ans->>rec.qid::text)::int;
        EXCEPTION WHEN others THEN picked := -1; END;
        IF picked = rec.correct_option THEN
          correct_n := correct_n + 1;
          earned := rec.max_points * (1 - p);
        END IF;
      END IF;
      INSERT INTO public.question_analyses
        (attempt_id, question_id, question_type, is_correct,
         points_earned, max_points, rasch_points, p_correct)
      VALUES
        (NEW.id, rec.qid, 'single_choice', (ans ? rec.qid::text) AND earned > 0,
         earned, rec.max_points, earned, p)
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
  EXCEPTION WHEN others THEN
    PERFORM public.log_trigger_error('apply_rasch_scoring', NEW.id, NEW.test_id, SQLSTATE, SQLERRM, NULL);
  END;

  RETURN NEW;
END;
$function$;

-- 6. Lock down wallet crediting to admins / service role
CREATE OR REPLACE FUNCTION public.credit_wallet_for_transaction(_txn_id uuid, _provider_txn_id text DEFAULT NULL::text)
 RETURNS wallet_transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t public.wallet_transactions;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO t FROM public.wallet_transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;
  IF t.status = 'paid' THEN RETURN t; END IF;
  IF t.status NOT IN ('pending') THEN RAISE EXCEPTION 'transaction_not_pending: %', t.status; END IF;

  PERFORM public.ensure_wallet(t.user_id);
  UPDATE public.wallets SET balance = balance + t.amount, updated_at = now() WHERE user_id = t.user_id;
  UPDATE public.wallet_transactions
    SET status = 'paid', paid_at = now(),
        provider_txn_id = COALESCE(_provider_txn_id, provider_txn_id), updated_at = now()
    WHERE id = t.id RETURNING * INTO t;
  RETURN t;
END; $function$;

CREATE OR REPLACE FUNCTION public.cancel_wallet_transaction(_txn_id uuid, _reason text DEFAULT NULL::text)
 RETURNS wallet_transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t public.wallet_transactions;
BEGIN
  SELECT * INTO t FROM public.wallet_transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT (t.user_id = auth.uid() AND t.status = 'pending') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF t.status = 'paid' THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    UPDATE public.wallets SET balance = GREATEST(0, balance - t.amount), updated_at = now()
      WHERE user_id = t.user_id;
    UPDATE public.wallet_transactions
      SET status = 'refunded', metadata = metadata || jsonb_build_object('cancel_reason', _reason), updated_at = now()
      WHERE id = t.id RETURNING * INTO t;
    RETURN t;
  END IF;

  IF t.status IN ('cancelled', 'failed', 'refunded') THEN RETURN t; END IF;

  UPDATE public.wallet_transactions
    SET status = 'cancelled', metadata = metadata || jsonb_build_object('cancel_reason', _reason), updated_at = now()
    WHERE id = t.id RETURNING * INTO t;
  RETURN t;
END; $function$;