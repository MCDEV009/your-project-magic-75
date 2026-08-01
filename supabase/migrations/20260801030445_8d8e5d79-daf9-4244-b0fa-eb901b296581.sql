CREATE TABLE IF NOT EXISTS public.exam_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid,
  participant_id uuid,
  session_id uuid,
  user_id uuid,
  violation_type text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_violations TO authenticated;
GRANT ALL ON public.exam_violations TO service_role;

ALTER TABLE public.exam_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view violations" ON public.exam_violations;
CREATE POLICY "Admins can view violations"
ON public.exam_violations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_exam_violation(
  _attempt_id uuid,
  _participant_id uuid DEFAULT NULL,
  _session_id uuid DEFAULT NULL,
  _violation_type text DEFAULT 'tab_switch',
  _details text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF _violation_type IS NULL OR length(_violation_type) > 64 THEN
    RAISE EXCEPTION 'invalid violation type';
  END IF;
  INSERT INTO public.exam_violations (attempt_id, participant_id, session_id, user_id, violation_type, details)
  VALUES (_attempt_id, _participant_id, _session_id, auth.uid(), _violation_type, left(coalesce(_details, ''), 500))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_exam_violation(uuid, uuid, uuid, text, text) TO anon, authenticated;

ALTER TABLE public.exam_violations REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_violations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;