
CREATE TABLE public.al_xorazmiy_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text NOT NULL,
  attempt_id uuid,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_al_xorazmiy_chat_participant ON public.al_xorazmiy_chat_messages(participant_id, created_at);
CREATE INDEX idx_al_xorazmiy_chat_attempt ON public.al_xorazmiy_chat_messages(attempt_id, created_at);

ALTER TABLE public.al_xorazmiy_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat messages"
ON public.al_xorazmiy_chat_messages FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert chat messages"
ON public.al_xorazmiy_chat_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage chat messages"
ON public.al_xorazmiy_chat_messages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
