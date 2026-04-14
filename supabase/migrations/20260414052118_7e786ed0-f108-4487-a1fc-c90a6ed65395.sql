
-- Question analytics: per-question statistics
CREATE TABLE public.question_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  total_attempts integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  incorrect_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  avg_time_seconds numeric DEFAULT 0,
  difficulty_score numeric DEFAULT 0.5,
  discrimination_index numeric DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(question_id)
);

ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view question analytics"
  ON public.question_analytics FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage question analytics"
  ON public.question_analytics FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Student rankings: progress tracking
CREATE TABLE public.student_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text NOT NULL,
  full_name text NOT NULL,
  total_tests integer NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  avg_score numeric NOT NULL DEFAULT 0,
  best_score numeric NOT NULL DEFAULT 0,
  rank_position integer DEFAULT 0,
  grade text DEFAULT 'N/A',
  last_test_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(participant_id)
);

ALTER TABLE public.student_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rankings"
  ON public.student_rankings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage rankings"
  ON public.student_rankings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- AI analysis history
CREATE TABLE public.ai_analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type text NOT NULL DEFAULT 'attempt',
  attempt_id uuid REFERENCES public.test_attempts(id) ON DELETE SET NULL,
  test_id uuid REFERENCES public.tests(id) ON DELETE SET NULL,
  participant_id text,
  analysis_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_used text DEFAULT 'gemini-3-flash-preview',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis"
  ON public.ai_analysis_history FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage all analysis"
  ON public.ai_analysis_history FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to recalculate question analytics after each attempt
CREATE OR REPLACE FUNCTION public.update_question_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_id uuid;
  q_correct integer;
  ans jsonb;
BEGIN
  IF NEW.status != 'finished' THEN RETURN NEW; END IF;
  
  ans := NEW.answers;
  
  FOR q_id, q_correct IN
    SELECT q.id, q.correct_option FROM questions q WHERE q.test_id = NEW.test_id AND q.question_type = 'single_choice'
  LOOP
    INSERT INTO question_analytics (question_id, test_id, total_attempts, correct_count, incorrect_count, skipped_count, difficulty_score)
    VALUES (
      q_id, NEW.test_id, 1,
      CASE WHEN (ans->>q_id::text)::integer = q_correct THEN 1 ELSE 0 END,
      CASE WHEN ans ? q_id::text AND (ans->>q_id::text)::integer != q_correct THEN 1 ELSE 0 END,
      CASE WHEN NOT ans ? q_id::text THEN 1 ELSE 0 END,
      0.5
    )
    ON CONFLICT (question_id) DO UPDATE SET
      total_attempts = question_analytics.total_attempts + 1,
      correct_count = question_analytics.correct_count + CASE WHEN (ans->>q_id::text)::integer = q_correct THEN 1 ELSE 0 END,
      incorrect_count = question_analytics.incorrect_count + CASE WHEN ans ? q_id::text AND (ans->>q_id::text)::integer != q_correct THEN 1 ELSE 0 END,
      skipped_count = question_analytics.skipped_count + CASE WHEN NOT ans ? q_id::text THEN 1 ELSE 0 END,
      difficulty_score = CASE 
        WHEN (question_analytics.total_attempts + 1) > 0 
        THEN 1.0 - (question_analytics.correct_count + CASE WHEN (ans->>q_id::text)::integer = q_correct THEN 1 ELSE 0 END)::numeric / (question_analytics.total_attempts + 1)
        ELSE 0.5 
      END,
      updated_at = now();
  END LOOP;

  -- Update student rankings
  INSERT INTO student_rankings (participant_id, full_name, total_tests, total_score, avg_score, best_score, last_test_at)
  SELECT 
    NEW.participant_id,
    COALESCE((SELECT tp.full_name FROM test_participants tp WHERE tp.participant_id = NEW.participant_id LIMIT 1), 'Unknown'),
    1, COALESCE(NEW.score, 0), COALESCE(NEW.score, 0), COALESCE(NEW.score, 0), now()
  ON CONFLICT (participant_id) DO UPDATE SET
    total_tests = student_rankings.total_tests + 1,
    total_score = student_rankings.total_score + COALESCE(NEW.score, 0),
    avg_score = (student_rankings.total_score + COALESCE(NEW.score, 0)) / (student_rankings.total_tests + 1),
    best_score = GREATEST(student_rankings.best_score, COALESCE(NEW.score, 0)),
    full_name = COALESCE((SELECT tp.full_name FROM test_participants tp WHERE tp.participant_id = NEW.participant_id LIMIT 1), student_rankings.full_name),
    last_test_at = now(),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger on test_attempts
CREATE TRIGGER update_analytics_on_attempt
  AFTER INSERT OR UPDATE ON public.test_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_question_analytics();

-- Enable realtime for rankings
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_rankings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.question_analytics;
