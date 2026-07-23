
CREATE OR REPLACE FUNCTION public.get_live_session_code(_session_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code FROM public.live_sessions WHERE id = _session_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_session_code(uuid) TO anon, authenticated;
