
-- 1) Drop overly-broad questions SELECT policy and create a safe view
DROP POLICY IF EXISTS "Questions readable via public view" ON public.questions;

DROP VIEW IF EXISTS public.questions_public;
CREATE VIEW public.questions_public
WITH (security_invoker = on) AS
SELECT
  q.id, q.test_id, q.question_type, q.options, q.points, q.order_index,
  q.created_at, q.max_points,
  q.question_text_uz, q.question_text_ru, q.question_text_en,
  q.image_url,
  q.condition_a_uz, q.condition_a_ru, q.condition_b_uz, q.condition_b_ru
FROM public.questions q
WHERE EXISTS (SELECT 1 FROM public.tests t WHERE t.id = q.test_id);

GRANT SELECT ON public.questions_public TO anon, authenticated;

-- 2) question_analyses: participants can read analyses for their own attempts
CREATE POLICY "Users view own question analyses"
  ON public.question_analyses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_attempts a
      JOIN public.test_participants p ON p.participant_id = a.participant_id
      WHERE a.id = question_analyses.attempt_id
        AND p.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.question_analyses TO authenticated;

-- 3) Tighten test_attempts INSERT: require the participant_id to exist
DROP POLICY IF EXISTS "Create attempts respecting pricing" ON public.test_attempts;
CREATE POLICY "Create attempts respecting pricing"
  ON public.test_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.is_known_participant(test_attempts.participant_id)
    AND EXISTS (
      SELECT 1
      FROM public.tests t
      LEFT JOIN public.test_pricing tp ON tp.test_id = t.id
      WHERE t.id = test_attempts.test_id
        AND (
          t.visibility <> 'paid'::test_visibility
          OR tp.is_free IS TRUE
          OR (auth.uid() IS NOT NULL AND get_user_plan(auth.uid()) = 'premium'::subscription_plan)
          OR (auth.uid() IS NOT NULL AND user_has_purchased_test(auth.uid(), t.id))
        )
    )
  );

-- 4) Restrict link_my_participants to authenticated only (no anon EXECUTE)
REVOKE EXECUTE ON FUNCTION public.link_my_participants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_participants() TO authenticated;
