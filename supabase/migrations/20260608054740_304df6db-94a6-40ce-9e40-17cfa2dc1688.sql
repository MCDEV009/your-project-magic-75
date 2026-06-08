
-- 1. profiles: username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq ON public.profiles (LOWER(username)) WHERE username IS NOT NULL;

-- allow authenticated users to read any profile (needed for username lookup)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- backfill profiles for existing users
INSERT INTO public.profiles (user_id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- 2. ensure_profile helper for client to call after sign-in
CREATE OR REPLACE FUNCTION public.ensure_profile(_username text DEFAULT NULL)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _name text;
  _p public.profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT email, COALESCE(raw_user_meta_data->>'full_name','') INTO _email, _name
    FROM auth.users WHERE id = _uid;
  INSERT INTO public.profiles (user_id, full_name, username)
    VALUES (_uid, COALESCE(NULLIF(_name,''), split_part(_email,'@',1)), NULLIF(LOWER(TRIM(_username)),''))
    ON CONFLICT (user_id) DO UPDATE
      SET username = COALESCE(EXCLUDED.username, public.profiles.username),
          updated_at = now()
    RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- 3. username -> email lookup for login
CREATE OR REPLACE FUNCTION public.lookup_email_by_username(_username text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  IF _username IS NULL OR length(TRIM(_username)) = 0 THEN RETURN NULL; END IF;
  SELECT u.email INTO _email
  FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(p.username) = LOWER(TRIM(_username))
  LIMIT 1;
  RETURN _email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_email_by_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;

-- 4. grant admin to palonkas@palon.com if exists
DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'palonkas@palon.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 5. rasch_settings singleton
CREATE TABLE IF NOT EXISTS public.rasch_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  prior_mean numeric NOT NULL DEFAULT 0.5,
  prior_strength numeric NOT NULL DEFAULT 4,
  p_min numeric NOT NULL DEFAULT 0.05,
  p_max numeric NOT NULL DEFAULT 0.95,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.rasch_settings TO authenticated;
GRANT ALL ON public.rasch_settings TO service_role;
ALTER TABLE public.rasch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read rasch_settings" ON public.rasch_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admins write rasch_settings" ON public.rasch_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
INSERT INTO public.rasch_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 6. update apply_rasch_scoring to use settings
CREATE OR REPLACE FUNCTION public.apply_rasch_scoring()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q record;
  ans jsonb;
  picked int;
  p numeric;
  earned numeric;
  mcq_total numeric := 0;
  correct_n int := 0;
  total_q int := 0;
  s_prior_mean numeric := 0.5;
  s_prior_strength numeric := 4;
  s_pmin numeric := 0.05;
  s_pmax numeric := 0.95;
BEGIN
  IF NEW.status <> 'finished' THEN RETURN NEW; END IF;

  SELECT prior_mean, prior_strength, p_min, p_max
    INTO s_prior_mean, s_prior_strength, s_pmin, s_pmax
    FROM public.rasch_settings WHERE id = true;
  s_prior_mean := COALESCE(s_prior_mean, 0.5);
  s_prior_strength := COALESCE(s_prior_strength, 4);
  s_pmin := COALESCE(s_pmin, 0.05);
  s_pmax := COALESCE(s_pmax, 0.95);

  ans := COALESCE(NEW.answers, '{}'::jsonb);

  FOR q IN
    SELECT q.id, q.correct_option, q.max_points,
      ((COALESCE(qa.correct_count,0)::numeric + (s_prior_mean * s_prior_strength))
        / (COALESCE(qa.total_attempts,0)::numeric + s_prior_strength)) AS p_smoothed
    FROM public.questions q
    LEFT JOIN public.question_analytics qa ON qa.question_id = q.id
    WHERE q.test_id = NEW.test_id AND q.question_type = 'single_choice'
  LOOP
    total_q := total_q + 1;
    p := LEAST(s_pmax, GREATEST(s_pmin, q.p_smoothed));
    earned := 0;
    IF ans ? q.id::text THEN
      BEGIN picked := (ans->>q.id::text)::int;
      EXCEPTION WHEN others THEN picked := -1; END;
      IF picked = q.correct_option THEN
        correct_n := correct_n + 1;
        earned := COALESCE(q.max_points,1) * (1 - p);
      END IF;
    END IF;
    INSERT INTO public.question_analyses
      (attempt_id, question_id, question_type, is_correct,
       points_earned, max_points, rasch_points, p_correct)
    VALUES
      (NEW.id, q.id, 'single_choice', (ans ? q.id::text) AND earned > 0,
       earned, COALESCE(q.max_points,1), earned, p)
    ON CONFLICT (attempt_id, question_id) DO UPDATE SET
       question_type = 'single_choice',
       is_correct    = EXCLUDED.is_correct,
       points_earned = EXCLUDED.points_earned,
       max_points    = EXCLUDED.max_points,
       rasch_points  = EXCLUDED.rasch_points,
       p_correct     = EXCLUDED.p_correct;
    mcq_total := mcq_total + earned;
  END LOOP;

  NEW.mcq_score := ROUND(mcq_total::numeric, 2);
  NEW.correct_answers := correct_n;
  IF NEW.total_questions IS NULL OR NEW.total_questions = 0 THEN
    NEW.total_questions := total_q;
  END IF;
  NEW.score := ROUND((COALESCE(NEW.mcq_score,0) + COALESCE(NEW.written_score,0))::numeric, 2);
  RETURN NEW;
END;
$function$;
