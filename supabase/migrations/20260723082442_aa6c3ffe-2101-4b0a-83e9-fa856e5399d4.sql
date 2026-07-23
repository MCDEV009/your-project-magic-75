
-- Lock down live_sessions SELECT: only participants, hosts, admins can read directly
DROP POLICY IF EXISTS "Anyone can read live sessions" ON public.live_sessions;

CREATE POLICY "Members hosts and admins read sessions"
ON public.live_sessions
FOR SELECT
TO authenticated
USING (
  host_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.live_participants p
    WHERE p.session_id = live_sessions.id AND p.user_id = auth.uid()
  )
);

-- Public RPC to look up a session by code (returns only non-sensitive fields)
CREATE OR REPLACE FUNCTION public.find_live_session_by_code(_code text)
RETURNS TABLE (id uuid, code text, status text, test_id uuid, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.code, s.status::text, s.test_id, s.starts_at, s.ends_at
  FROM public.live_sessions s
  WHERE s.code = UPPER(TRIM(_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_live_session_by_code(text) TO anon, authenticated;

-- Tighten live_participants INSERT: session must exist and not be ended,
-- and user_id (when provided) must match the caller.
DROP POLICY IF EXISTS "Anyone can join a session" ON public.live_participants;

CREATE POLICY "Join active sessions with matching identity"
ON public.live_participants
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE s.id = live_participants.session_id
      AND s.status <> 'ended'
  )
);
