CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  api_key text NOT NULL,
  model text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_providers_one_active ON public.ai_providers (is_active) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai providers" ON public.ai_providers FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.ai_finetune_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  provider_job_id text,
  training_file_id text,
  base_model text NOT NULL,
  fine_tuned_model text,
  status text NOT NULL DEFAULT 'queued',
  examples_count integer NOT NULL DEFAULT 0,
  subject_id uuid,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_finetune_jobs TO authenticated;
GRANT ALL ON public.ai_finetune_jobs TO service_role;
ALTER TABLE public.ai_finetune_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view finetune jobs" ON public.ai_finetune_jobs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));