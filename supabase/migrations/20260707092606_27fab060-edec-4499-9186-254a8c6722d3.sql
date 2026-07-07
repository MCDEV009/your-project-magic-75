
-- 1) profiles: restrict SELECT to own row (SECURITY DEFINER funcs still work)
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) student_rankings: only admins can read (contains participant_id tokens)
DROP POLICY IF EXISTS "Anyone can read rankings" ON public.student_rankings;
DROP POLICY IF EXISTS "Public read rankings" ON public.student_rankings;
DROP POLICY IF EXISTS "Authenticated read rankings" ON public.student_rankings;
DROP POLICY IF EXISTS "Rankings readable by everyone" ON public.student_rankings;

CREATE POLICY "Admins read rankings"
ON public.student_rankings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.student_rankings FROM anon;

-- 3) usage_counters: prevent user-controlled writes; use SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users update own counters" ON public.usage_counters;
DROP POLICY IF EXISTS "Users upsert own counters" ON public.usage_counters;
DROP POLICY IF EXISTS "Users insert own counters" ON public.usage_counters;

REVOKE INSERT, UPDATE, DELETE ON public.usage_counters FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_usage_counter(_field text)
RETURNS public.usage_counters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _month text;
  _row public.usage_counters;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _field NOT IN ('mocks_taken','ai_requests','image_uploads') THEN
    RAISE EXCEPTION 'invalid_field';
  END IF;
  _month := to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM');

  INSERT INTO public.usage_counters (user_id, period_month, mocks_taken, ai_requests, image_uploads)
  VALUES (_uid, _month,
    CASE WHEN _field='mocks_taken' THEN 1 ELSE 0 END,
    CASE WHEN _field='ai_requests' THEN 1 ELSE 0 END,
    CASE WHEN _field='image_uploads' THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, period_month) DO UPDATE SET
    mocks_taken   = public.usage_counters.mocks_taken   + CASE WHEN _field='mocks_taken'   THEN 1 ELSE 0 END,
    ai_requests   = public.usage_counters.ai_requests   + CASE WHEN _field='ai_requests'   THEN 1 ELSE 0 END,
    image_uploads = public.usage_counters.image_uploads + CASE WHEN _field='image_uploads' THEN 1 ELSE 0 END,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

-- Ensure the unique constraint exists for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='usage_counters_user_id_period_month_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='usage_counters_user_id_period_month_key'
  ) THEN
    BEGIN
      ALTER TABLE public.usage_counters ADD CONSTRAINT usage_counters_user_id_period_month_key UNIQUE (user_id, period_month);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;
