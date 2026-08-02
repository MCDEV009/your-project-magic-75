
CREATE OR REPLACE FUNCTION public.apply_rasch_scoring()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_analytics_on_attempt ON public.test_attempts;
DROP TRIGGER IF EXISTS trg_update_qa_after ON public.test_attempts;
CREATE TRIGGER trg_update_qa_after_ins
AFTER INSERT ON public.test_attempts
FOR EACH ROW
WHEN (new.status = 'finished'::attempt_status)
EXECUTE FUNCTION public.update_question_analytics();

CREATE TRIGGER trg_update_qa_after_upd
AFTER UPDATE OF status ON public.test_attempts
FOR EACH ROW
WHEN (new.status = 'finished'::attempt_status AND old.status IS DISTINCT FROM new.status)
EXECUTE FUNCTION public.update_question_analytics();

CREATE OR REPLACE FUNCTION public.start_test_attempt(
  _test_id uuid,
  _participant_id text,
  _full_name text,
  _total_questions integer DEFAULT NULL,
  _session_id uuid DEFAULT NULL
)
RETURNS test_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE a public.test_attempts;
BEGIN
  IF _participant_id !~ '^[A-Z0-9]{8,32}$' THEN RAISE EXCEPTION 'invalid_participant_id'; END IF;
  IF length(COALESCE(TRIM(_full_name),'')) < 1 OR length(_full_name) > 200 THEN
    RAISE EXCEPTION 'invalid_full_name';
  END IF;
  IF NOT public.can_start_attempt(_test_id) THEN RAISE EXCEPTION 'payment_required'; END IF;

  INSERT INTO public.test_participants (participant_id, full_name, user_id)
  VALUES (_participant_id, TRIM(_full_name), auth.uid())
  ON CONFLICT (participant_id) DO NOTHING;

  INSERT INTO public.test_attempts (test_id, participant_id, total_questions, status, session_id)
  VALUES (_test_id, _participant_id,
          COALESCE(_total_questions, (SELECT count(*) FROM public.questions WHERE test_id = _test_id)),
          'in_progress'::attempt_status, _session_id)
  RETURNING * INTO a;
  RETURN a;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_test_attempt(uuid, text, text, integer, uuid) TO anon, authenticated;
