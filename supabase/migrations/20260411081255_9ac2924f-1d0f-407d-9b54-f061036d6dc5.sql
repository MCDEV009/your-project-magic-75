
-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Private tests viewable with code" ON public.tests;

-- Allow viewing all tests (both public and private) - the test_code acts as the access control
-- for private tests, verified at the application layer in TestEntry
CREATE POLICY "Tests are viewable by everyone"
ON public.tests
FOR SELECT
TO anon, authenticated
USING (true);
