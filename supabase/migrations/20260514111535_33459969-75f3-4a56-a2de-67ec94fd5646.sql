
-- Plan enum
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('free','pro','premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  route text NOT NULL,
  required_roles text[],
  granted boolean NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert audit entries"
ON public.admin_audit_log FOR INSERT TO anon, authenticated
WITH CHECK (length(coalesce(route,'')) > 0 AND length(coalesce(route,'')) < 500);

CREATE POLICY "Admins view audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. User plans
CREATE TABLE IF NOT EXISTS public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plan"
ON public.user_plans FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own plan"
ON public.user_plans FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage plans"
ON public.user_plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Usage counters
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_month text NOT NULL,
  mocks_taken int NOT NULL DEFAULT 0,
  ai_requests int NOT NULL DEFAULT 0,
  image_uploads int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_month)
);
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own counters"
ON public.usage_counters FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users upsert own counters"
ON public.usage_counters FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own counters"
ON public.usage_counters FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Plan payments
CREATE TABLE IF NOT EXISTS public.plan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan subscription_plan NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'UZS',
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'coming_soon',
  test_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments"
ON public.plan_payments FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own payments"
ON public.plan_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage payments"
ON public.plan_payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Test pricing
CREATE TABLE IF NOT EXISTS public.test_pricing (
  test_id uuid PRIMARY KEY,
  price_uzs numeric NOT NULL DEFAULT 10000,
  is_free boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.test_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing viewable by everyone"
ON public.test_pricing FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage pricing"
ON public.test_pricing FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing private tests to paid
UPDATE public.tests SET visibility = 'paid' WHERE visibility = 'private';

-- Helper function for plan limits
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS subscription_plan
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.user_plans
     WHERE user_id = _user_id
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     LIMIT 1),
    'free'::subscription_plan
  );
$$;
