
ALTER TABLE public.test_participants ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_test_participants_user_id ON public.test_participants(user_id);

-- Allow logged-in users to see their own participant rows
DROP POLICY IF EXISTS "Users view own participants" ON public.test_participants;
CREATE POLICY "Users view own participants"
  ON public.test_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Allow logged-in user to see their own attempts (via participant link)
DROP POLICY IF EXISTS "Users view own attempts" ON public.test_attempts;
CREATE POLICY "Users view own attempts"
  ON public.test_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.test_participants p
    WHERE p.participant_id = test_attempts.participant_id
      AND p.user_id = auth.uid()
  ));
