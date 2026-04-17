-- Fix finish-test RLS: allow transition from in_progress -> finished
DROP POLICY IF EXISTS "Only in-progress attempts can be updated" ON public.test_attempts;

CREATE POLICY "In-progress attempts can be updated or finished"
ON public.test_attempts
FOR UPDATE
TO anon, authenticated
USING (status = 'in_progress'::attempt_status)
WITH CHECK (status IN ('in_progress'::attempt_status, 'finished'::attempt_status));

-- Per-question analysis storage
CREATE TABLE IF NOT EXISTS public.question_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  question_type text NOT NULL,
  user_answer jsonb,
  is_correct boolean,
  points_earned numeric DEFAULT 0,
  max_points numeric DEFAULT 0,
  ai_feedback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_analyses_attempt ON public.question_analyses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_analyses_question ON public.question_analyses(question_id);

ALTER TABLE public.question_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view question analyses"
ON public.question_analyses FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert question analyses"
ON public.question_analyses FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage question analyses"
ON public.question_analyses FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));