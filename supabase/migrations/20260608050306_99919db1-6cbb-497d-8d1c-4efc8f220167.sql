
DROP POLICY IF EXISTS "Chat select bound to attempt" ON public.al_xorazmiy_chat_messages;
DROP POLICY IF EXISTS "Chat insert bound to attempt" ON public.al_xorazmiy_chat_messages;
DROP POLICY IF EXISTS "Chat delete bound to attempt" ON public.al_xorazmiy_chat_messages;

CREATE POLICY "Chat select bound to attempt"
ON public.al_xorazmiy_chat_messages
FOR SELECT
USING (
  attempt_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.test_attempts a
    WHERE a.id = al_xorazmiy_chat_messages.attempt_id
      AND a.participant_id = al_xorazmiy_chat_messages.participant_id
  )
  AND EXISTS (
    SELECT 1 FROM public.test_participants p
    WHERE p.participant_id = al_xorazmiy_chat_messages.participant_id
      AND (
        (p.user_id IS NOT NULL AND p.user_id = auth.uid())
        OR (p.user_id IS NULL AND auth.uid() IS NULL)
      )
  )
);

CREATE POLICY "Chat insert bound to attempt"
ON public.al_xorazmiy_chat_messages
FOR INSERT
WITH CHECK (
  attempt_id IS NOT NULL
  AND role = ANY (ARRAY['user'::text, 'assistant'::text])
  AND length(COALESCE(content, '')) > 0
  AND length(content) <= 8000
  AND EXISTS (
    SELECT 1 FROM public.test_attempts a
    WHERE a.id = al_xorazmiy_chat_messages.attempt_id
      AND a.participant_id = al_xorazmiy_chat_messages.participant_id
  )
  AND EXISTS (
    SELECT 1 FROM public.test_participants p
    WHERE p.participant_id = al_xorazmiy_chat_messages.participant_id
      AND (
        (p.user_id IS NOT NULL AND p.user_id = auth.uid())
        OR (p.user_id IS NULL AND auth.uid() IS NULL)
      )
  )
);

CREATE POLICY "Chat delete bound to attempt"
ON public.al_xorazmiy_chat_messages
FOR DELETE
USING (
  attempt_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.test_attempts a
    WHERE a.id = al_xorazmiy_chat_messages.attempt_id
      AND a.participant_id = al_xorazmiy_chat_messages.participant_id
  )
  AND EXISTS (
    SELECT 1 FROM public.test_participants p
    WHERE p.participant_id = al_xorazmiy_chat_messages.participant_id
      AND (
        (p.user_id IS NOT NULL AND p.user_id = auth.uid())
        OR (p.user_id IS NULL AND auth.uid() IS NULL)
      )
  )
);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.questions FROM anon;

DROP POLICY IF EXISTS "Participants can be created by anyone" ON public.test_participants;

CREATE POLICY "Participants can be created with valid id"
ON public.test_participants
FOR INSERT
WITH CHECK (
  participant_id ~ '^[A-Z0-9]{8,32}$'
  AND length(COALESCE(full_name, '')) BETWEEN 1 AND 200
  AND (
    auth.uid() IS NULL
    OR user_id IS NULL
    OR user_id = auth.uid()
  )
);
