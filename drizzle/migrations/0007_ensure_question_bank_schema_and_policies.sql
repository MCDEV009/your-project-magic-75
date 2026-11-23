CREATE TABLE IF NOT EXISTS public.question_bank (
  id text PRIMARY KEY,
  subject_key text NOT NULL DEFAULT 'matematika',
  source_id text NOT NULL,
  source_kind text NOT NULL DEFAULT 'mock',
  source_date date,
  qnum integer NOT NULL,
  q_type text NOT NULL,
  text text,
  options jsonb,
  parts jsonb,
  items jsonb,
  has_figure boolean NOT NULL DEFAULT false,
  text_reliable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  topic text,
  quality text NOT NULL DEFAULT 'raw'
);

ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS subject_key text NOT NULL DEFAULT 'matematika';
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'mock';
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS source_date date;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS qnum integer;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS q_type text;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS text text;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS options jsonb;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS parts jsonb;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS has_figure boolean NOT NULL DEFAULT false;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS text_reliable boolean NOT NULL DEFAULT false;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS quality text NOT NULL DEFAULT 'raw';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Content roles read question bank" ON public.question_bank;
DROP POLICY IF EXISTS "Admins manage question bank" ON public.question_bank;

CREATE POLICY "Content roles read question bank"
ON public.question_bank
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'editor'::public.app_role)
);

CREATE POLICY "Admins manage question bank"
ON public.question_bank
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS question_bank_subject_type_reliable_date_idx
ON public.question_bank (subject_key, q_type, text_reliable, source_date DESC);