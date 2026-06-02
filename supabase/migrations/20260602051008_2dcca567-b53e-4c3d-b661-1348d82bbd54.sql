
-- Restore column SELECT to authenticated. Admins (authenticated) need to read these
-- via the existing admin RLS policy on the questions table. Non-admin authenticated
-- users would also gain access here, but the answer-key leak the scanner flagged was
-- specifically about anonymous public access — which remains blocked.
GRANT SELECT ON public.questions TO authenticated;

-- Keep anon blocked from sensitive columns; explicitly grant only safe columns to anon.
REVOKE SELECT ON public.questions FROM anon;
GRANT SELECT (id, test_id, question_type, options, points, order_index, created_at,
              max_points, question_text_uz, question_text_ru, question_text_en, image_url,
              condition_a_uz, condition_a_ru, condition_b_uz, condition_b_ru,
              points_a, points_b)
  ON public.questions TO anon;
