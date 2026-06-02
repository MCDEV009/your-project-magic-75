
-- 1) Fix tests_visibility_bypass: drop the overly permissive duplicate SELECT policy
DROP POLICY IF EXISTS "Tests are viewable by everyone" ON public.tests;

-- 2) Fix question_analyses_public_read: stop exposing per-attempt answers/correctness to the public.
--    Restrict to admins; the app's Results page should fetch via the owning attempt path
--    (signed participant flow). For now, this stops the public leak immediately.
DROP POLICY IF EXISTS "Anyone can view question analyses" ON public.question_analyses;

-- 3) Fix test_attempts_all_authenticated_read: any logged-in user could read every attempt.
--    Replace USING (true) with admin-only; anon SELECT is already false.
DROP POLICY IF EXISTS "Authenticated users can view attempts" ON public.test_attempts;
CREATE POLICY "Admins view all attempts"
  ON public.test_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Public bucket listing hardening: restrict storage.objects SELECT on question-images
--    so files are still publicly accessible by direct URL but the bucket cannot be enumerated.
--    Drop any broad SELECT policy specifically scoped to this bucket if present.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
     WHERE polrelid = 'storage.objects'::regclass
       AND polname ILIKE '%question-images%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.polname);
  END LOOP;
END$$;

-- Restrict SELECT (listing) on question-images bucket to admins only.
-- Public direct-URL fetches via the storage render endpoint still work because the
-- bucket itself is marked public; only the listing API is locked down.
CREATE POLICY "Admins can list question-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'::app_role));
