
-- Create a SECURITY DEFINER function to get a single test attempt by ID
-- This prevents bulk enumeration while allowing access by known UUID
CREATE OR REPLACE FUNCTION public.get_test_attempt_by_id(p_attempt_id uuid)
RETURNS SETOF test_attempts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.test_attempts WHERE id = p_attempt_id LIMIT 1;
$$;

-- Create a function to get attempt status fields for polling
CREATE OR REPLACE FUNCTION public.get_attempt_status(p_attempt_id uuid)
RETURNS TABLE(evaluation_status text, ai_evaluation jsonb, written_score numeric, score numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.evaluation_status, t.ai_evaluation, t.written_score, t.score
  FROM public.test_attempts t WHERE t.id = p_attempt_id LIMIT 1;
$$;

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Participants can view their own attempt" ON public.test_attempts;

-- Admins and authenticated users can view all attempts (for Dashboard/Admin)
CREATE POLICY "Authenticated users can view attempts"
ON public.test_attempts
FOR SELECT
TO authenticated
USING (true);

-- Anon users cannot directly SELECT - must use RPC functions
CREATE POLICY "Anon cannot directly select attempts"
ON public.test_attempts
FOR SELECT
TO anon
USING (false);
