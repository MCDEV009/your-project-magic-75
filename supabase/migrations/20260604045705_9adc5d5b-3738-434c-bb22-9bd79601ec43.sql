
-- 1) ai_analysis_history: participants can SELECT their own analysis rows
CREATE POLICY "Users view own analysis history"
  ON public.ai_analysis_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_participants p
      WHERE p.participant_id = ai_analysis_history.participant_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.test_attempts a
      JOIN public.test_participants p ON p.participant_id = a.participant_id
      WHERE a.id = ai_analysis_history.attempt_id
        AND p.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.ai_analysis_history TO authenticated;

-- 2) tests: allow reading any test the user has an attempt or purchase for
DROP POLICY IF EXISTS "Public tests are viewable by everyone" ON public.tests;
CREATE POLICY "Tests are viewable by everyone or owners"
  ON public.tests FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'::test_visibility
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.test_purchases tp
      WHERE tp.test_id = tests.id AND tp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.test_attempts ta
      JOIN public.test_participants p ON p.participant_id = ta.participant_id
      WHERE ta.test_id = tests.id AND p.user_id = auth.uid()
    )
  );

-- 3) Backfill helper: link participants by name/email to current user
CREATE OR REPLACE FUNCTION public.link_my_participants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _name text;
  _updated integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  SELECT email, COALESCE(raw_user_meta_data->>'full_name','')
    INTO _email, _name
    FROM auth.users WHERE id = auth.uid();

  UPDATE public.test_participants
    SET user_id = auth.uid()
    WHERE user_id IS NULL
      AND (
        (length(COALESCE(_name,'')) > 0 AND full_name = _name)
        OR (length(COALESCE(_email,'')) > 0 AND full_name = _email)
      );
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_my_participants() TO authenticated;
