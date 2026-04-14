
-- Drop the overly permissive SELECT policy on ai_analysis_history and replace
DROP POLICY IF EXISTS "Users can view their own analysis" ON public.ai_analysis_history;

CREATE POLICY "Anyone can view analysis history"
  ON public.ai_analysis_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- The ALL policy for admins already covers INSERT/UPDATE/DELETE
-- No additional INSERT policy needed for non-admins since edge functions use service role
