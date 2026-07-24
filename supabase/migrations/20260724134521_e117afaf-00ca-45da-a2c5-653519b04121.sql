
CREATE OR REPLACE FUNCTION public.can_start_attempt(_test_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tests t
      LEFT JOIN public.test_pricing tp ON tp.test_id = t.id
     WHERE t.id = _test_id
       AND (
         t.visibility <> 'paid'::test_visibility
         OR tp.is_free IS TRUE
         OR (auth.uid() IS NOT NULL AND public.get_user_plan(auth.uid()) = 'premium'::subscription_plan)
         OR (auth.uid() IS NOT NULL AND public.user_has_purchased_test(auth.uid(), t.id))
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_start_attempt(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Create attempts respecting pricing" ON public.test_attempts;
CREATE POLICY "Create attempts respecting pricing"
ON public.test_attempts
FOR INSERT
WITH CHECK (
  public.is_known_participant(participant_id)
  AND public.can_start_attempt(test_id)
);
