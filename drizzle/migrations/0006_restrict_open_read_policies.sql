DROP POLICY IF EXISTS "Anyone can view rankings" ON public.student_rankings;
CREATE POLICY "Admins can view rankings" ON public.student_rankings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'analyst'));

DROP POLICY IF EXISTS "payment_settings_read" ON public.payment_settings;
CREATE POLICY "Admins can view payment settings" ON public.payment_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Anyone can view question analytics" ON public.question_analytics;
CREATE POLICY "Participants and staff can view question analytics" ON public.question_analytics FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'analyst')
  OR EXISTS (
    SELECT 1 FROM public.test_attempts ta
    JOIN public.test_participants tp ON tp.participant_id = ta.participant_id
    WHERE ta.test_id = question_analytics.test_id AND tp.user_id = auth.uid()
  )
);