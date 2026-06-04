
ALTER TABLE public.test_pricing
  ADD CONSTRAINT test_pricing_test_id_fkey
  FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';
