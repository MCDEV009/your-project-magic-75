-- 1) Ownership checks on attempt RPCs
DROP FUNCTION IF EXISTS public.get_test_attempt_by_id(uuid);
CREATE OR REPLACE FUNCTION public.get_test_attempt_by_id(p_attempt_id uuid, _participant_id text DEFAULT NULL)
RETURNS SETOF public.test_attempts
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.* FROM public.test_attempts a
  WHERE a.id = p_attempt_id
    AND (
      (_participant_id IS NOT NULL AND a.participant_id = _participant_id)
      OR (auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.test_participants tp
            WHERE tp.participant_id = a.participant_id AND tp.user_id = auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.get_attempt_status(uuid);
CREATE OR REPLACE FUNCTION public.get_attempt_status(p_attempt_id uuid, _participant_id text DEFAULT NULL)
RETURNS TABLE(evaluation_status text, ai_evaluation jsonb, written_score numeric, score numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.evaluation_status, t.ai_evaluation, t.written_score, t.score
  FROM public.test_attempts t
  WHERE t.id = p_attempt_id
    AND (
      (_participant_id IS NOT NULL AND t.participant_id = _participant_id)
      OR (auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.test_participants tp
            WHERE tp.participant_id = t.participant_id AND tp.user_id = auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  LIMIT 1;
$$;

-- 2) live_participants update policy
DROP POLICY IF EXISTS "Participant or host can update" ON public.live_participants;
CREATE POLICY "Owner host or admin can update participant"
ON public.live_participants
FOR UPDATE
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = live_participants.session_id AND s.host_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = live_participants.session_id AND s.host_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3) plan_payments status spoofing
DROP POLICY IF EXISTS "Users create own payments" ON public.plan_payments;
CREATE POLICY "Users create own pending payments"
ON public.plan_payments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');
