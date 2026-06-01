-- Restrict ai_analysis_history reads to admins only.
-- Edge functions write via service_role (bypasses RLS), so no public read needed.
DROP POLICY IF EXISTS "Anyone can view analysis history" ON public.ai_analysis_history;

-- Remove public INSERT on question_analyses; only the evaluate-written-answers
-- edge function (service_role) should insert rows. Admin ALL policy remains.
DROP POLICY IF EXISTS "Anyone can insert question analyses" ON public.question_analyses;