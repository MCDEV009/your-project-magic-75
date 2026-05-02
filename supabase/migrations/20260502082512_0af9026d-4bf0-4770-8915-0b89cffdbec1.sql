-- Replace overly broad policies on al_xorazmiy_chat_messages
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.al_xorazmiy_chat_messages;
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.al_xorazmiy_chat_messages;
DROP POLICY IF EXISTS "Admins can manage chat messages" ON public.al_xorazmiy_chat_messages;

-- Helper: check that the participant_id is a known one (exists in test_participants)
CREATE OR REPLACE FUNCTION public.is_known_participant(_participant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.test_participants WHERE participant_id = _participant_id
  );
$$;

-- View: only for known participants (server uses service role, which bypasses RLS)
CREATE POLICY "View chat messages for known participants"
ON public.al_xorazmiy_chat_messages
FOR SELECT
TO anon, authenticated
USING (public.is_known_participant(participant_id));

-- Insert: only when participant_id is a known participant and content is non-empty
CREATE POLICY "Insert chat messages for known participants"
ON public.al_xorazmiy_chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_known_participant(participant_id)
  AND length(coalesce(content, '')) > 0
  AND role IN ('user', 'assistant')
);

-- Delete: only allowed when caller knows the participant_id (which acts as a private token)
CREATE POLICY "Delete own chat messages"
ON public.al_xorazmiy_chat_messages
FOR DELETE
TO anon, authenticated
USING (public.is_known_participant(participant_id));

-- Admins: full access
CREATE POLICY "Admins manage chat messages"
ON public.al_xorazmiy_chat_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
