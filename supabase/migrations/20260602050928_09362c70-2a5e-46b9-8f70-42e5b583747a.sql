
-- ============================================================
-- 1) QUESTIONS: hide answer keys behind a view
-- ============================================================

-- View with only safe columns
CREATE OR REPLACE VIEW public.questions_public
WITH (security_invoker = true) AS
SELECT
  q.id, q.test_id, q.question_type, q.options, q.points, q.order_index,
  q.created_at, q.max_points,
  q.question_text_uz, q.question_text_ru, q.question_text_en, q.image_url,
  q.condition_a_uz, q.condition_a_ru, q.condition_b_uz, q.condition_b_ru,
  q.points_a, q.points_b
FROM public.questions q;

GRANT SELECT ON public.questions_public TO anon, authenticated;

-- Remove direct public SELECT on questions
DROP POLICY IF EXISTS "Questions viewable for accessible tests" ON public.questions;

-- Re-add a SELECT policy that only admins satisfy (admin ALL policy already covers them,
-- but be explicit so direct queries by non-admins return zero rows rather than error).
CREATE POLICY "Only admins read questions directly"
  ON public.questions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- The view is needed by the policy on the underlying table? With security_invoker=true,
-- queries through the view run with the caller's permissions and RLS applies. So we also
-- need a SELECT policy on `questions` that lets the view return rows to anon/authenticated
-- but only the safe columns. Add a permissive policy that mirrors test accessibility.
CREATE POLICY "Questions readable via public view"
  ON public.questions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tests t WHERE t.id = questions.test_id)
  );
-- NOTE: We rely on the application using questions_public (which excludes the sensitive
-- columns). Combined with the new RPC + view pattern, sensitive columns are not selected
-- by clients. To fully hide them at the column level too, we revoke column SELECT below.

-- Column-level revoke on sensitive answer fields for anon/authenticated.
REVOKE SELECT (correct_option, model_answer_uz, model_answer_ru, model_answer_en,
               rubric_uz, rubric_ru)
  ON public.questions FROM anon, authenticated;

-- Grant SELECT on only the safe columns to anon/authenticated, so direct SELECTs that
-- restrict columns still work, but any attempt to read sensitive columns is denied.
GRANT SELECT (id, test_id, question_type, options, points, order_index, created_at,
              max_points, question_text_uz, question_text_ru, question_text_en, image_url,
              condition_a_uz, condition_a_ru, condition_b_uz, condition_b_ru,
              points_a, points_b)
  ON public.questions TO anon, authenticated;

-- ============================================================
-- 2) TEST ATTEMPTS: ownership-enforced updates
-- ============================================================

-- Remove the broad anon/authenticated UPDATE policy
DROP POLICY IF EXISTS "In-progress attempts can be updated or finished" ON public.test_attempts;

-- Only admins can update directly. Participants must use the RPC below.
CREATE POLICY "Admins update attempts"
  ON public.test_attempts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- SECURITY DEFINER function used by participants. Verifies that the supplied
-- participant_id matches the attempt's owner and the attempt is still in progress.
CREATE OR REPLACE FUNCTION public.update_test_attempt(
  _attempt_id uuid,
  _participant_id text,
  _answers jsonb,
  _written_answers jsonb,
  _finish boolean DEFAULT false
)
RETURNS public.test_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.test_attempts;
BEGIN
  SELECT * INTO a FROM public.test_attempts WHERE id = _attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt_not_found';
  END IF;
  IF a.participant_id IS DISTINCT FROM _participant_id THEN
    RAISE EXCEPTION 'not_attempt_owner';
  END IF;
  IF a.status <> 'in_progress'::attempt_status THEN
    RAISE EXCEPTION 'attempt_not_in_progress';
  END IF;

  UPDATE public.test_attempts
    SET answers = COALESCE(_answers, answers),
        written_answers = COALESCE(_written_answers, written_answers),
        status = CASE WHEN _finish THEN 'finished'::attempt_status ELSE status END,
        finished_at = CASE WHEN _finish THEN now() ELSE finished_at END,
        evaluation_status = CASE WHEN _finish THEN 'pending' ELSE evaluation_status END
    WHERE id = _attempt_id
    RETURNING * INTO a;

  RETURN a;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_test_attempt(uuid, text, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_test_attempt(uuid, text, jsonb, jsonb, boolean) TO anon, authenticated;

-- ============================================================
-- 3) TEST ATTEMPTS INSERT: paid test gating
-- ============================================================

DROP POLICY IF EXISTS "Anyone can create attempts" ON public.test_attempts;

-- For free / non-paid tests, allow anyone. For paid tests, require an authenticated
-- user with an active premium plan.
CREATE POLICY "Create attempts respecting pricing"
  ON public.test_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tests t
      LEFT JOIN public.test_pricing tp ON tp.test_id = t.id
      WHERE t.id = test_attempts.test_id
        AND (
          -- free, no pricing row, public/private (non-paid)
          (t.visibility <> 'paid'::test_visibility)
          OR (tp.is_free IS TRUE)
          OR (
            -- Paid test: require authenticated premium user
            auth.uid() IS NOT NULL
            AND public.get_user_plan(auth.uid()) = 'premium'::subscription_plan
          )
        )
    )
  );

-- ============================================================
-- 4) CHAT MESSAGES: tighten via attempt ownership
-- ============================================================

-- The existing policy uses is_known_participant which only checks existence.
-- Replace SELECT and DELETE with attempt-bound ownership: require the attempt_id and
-- verify (participant_id, attempt_id) actually belong together.
DROP POLICY IF EXISTS "View chat messages for known participants" ON public.al_xorazmiy_chat_messages;
DROP POLICY IF EXISTS "Delete own chat messages" ON public.al_xorazmiy_chat_messages;
DROP POLICY IF EXISTS "Insert chat messages for known participants" ON public.al_xorazmiy_chat_messages;

CREATE POLICY "Chat select bound to attempt"
  ON public.al_xorazmiy_chat_messages FOR SELECT
  TO anon, authenticated
  USING (
    attempt_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.test_attempts a
      WHERE a.id = al_xorazmiy_chat_messages.attempt_id
        AND a.participant_id = al_xorazmiy_chat_messages.participant_id
    )
  );

CREATE POLICY "Chat delete bound to attempt"
  ON public.al_xorazmiy_chat_messages FOR DELETE
  TO anon, authenticated
  USING (
    attempt_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.test_attempts a
      WHERE a.id = al_xorazmiy_chat_messages.attempt_id
        AND a.participant_id = al_xorazmiy_chat_messages.participant_id
    )
  );

CREATE POLICY "Chat insert bound to attempt"
  ON public.al_xorazmiy_chat_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    attempt_id IS NOT NULL
    AND (role = ANY (ARRAY['user'::text, 'assistant'::text]))
    AND length(COALESCE(content, '')) > 0
    AND length(content) <= 8000
    AND EXISTS (
      SELECT 1 FROM public.test_attempts a
      WHERE a.id = al_xorazmiy_chat_messages.attempt_id
        AND a.participant_id = al_xorazmiy_chat_messages.participant_id
    )
  );
