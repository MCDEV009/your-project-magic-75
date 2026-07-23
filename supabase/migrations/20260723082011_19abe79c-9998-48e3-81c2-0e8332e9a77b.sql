
DROP POLICY IF EXISTS "Anyone can read participants" ON public.live_participants;

CREATE POLICY "Members host or admin can read participants"
  ON public.live_participants
  FOR SELECT
  TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE s.id = live_participants.session_id
        AND (s.host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
    OR EXISTS (
      SELECT 1 FROM public.live_participants me
      WHERE me.session_id = live_participants.session_id
        AND me.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_live_participants(_session_id uuid)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  participant_id text,
  display_name text,
  joined_at timestamptz,
  finished_at timestamptz,
  attempt_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.session_id, p.participant_id, p.display_name,
         p.joined_at, p.finished_at, p.attempt_id
  FROM public.live_participants p
  WHERE p.session_id = _session_id
  ORDER BY p.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_participants(uuid) TO anon, authenticated;
