
-- Session status enum
DO $$ BEGIN
  CREATE TYPE public.live_session_status AS ENUM ('scheduled','lobby','running','ended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Session code generator (6-char alnum, uppercase)
CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text := ''; i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END; $$;

-- live_sessions
CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT public.generate_session_code(),
  host_user_id uuid NOT NULL,
  title text,
  status public.live_session_status NOT NULL DEFAULT 'scheduled',
  starts_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 5400,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read live sessions"
  ON public.live_sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins and hosts create sessions"
  ON public.live_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_user_id AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Host or admin can update session"
  ON public.live_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Host or admin can delete session"
  ON public.live_sessions FOR DELETE TO authenticated
  USING (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_live_sessions_updated
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- live_participants
CREATE TABLE public.live_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid,
  participant_id text NOT NULL,
  display_name text NOT NULL,
  attempt_id uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, participant_id)
);

GRANT SELECT, INSERT, UPDATE ON public.live_participants TO anon, authenticated;
GRANT ALL ON public.live_participants TO service_role;

ALTER TABLE public.live_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read participants"
  ON public.live_participants FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join a session"
  ON public.live_participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participant or host can update"
  ON public.live_participants FOR UPDATE
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE s.id = live_participants.session_id
        AND (s.host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
    OR user_id IS NULL
  )
  WITH CHECK (true);

CREATE TRIGGER trg_live_participants_updated
  BEFORE UPDATE ON public.live_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link attempts to sessions
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_test_attempts_session_id ON public.test_attempts(session_id);

-- Trigger: when an attempt tied to a session is finished, mark participant finished
CREATE OR REPLACE FUNCTION public.sync_live_participant_finished()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL
     AND NEW.status = 'finished'::attempt_status
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.live_participants
      SET finished_at = COALESCE(finished_at, now()),
          attempt_id = COALESCE(attempt_id, NEW.id),
          updated_at = now()
      WHERE session_id = NEW.session_id
        AND participant_id = NEW.participant_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_live_participant_finished ON public.test_attempts;
CREATE TRIGGER trg_sync_live_participant_finished
  AFTER UPDATE ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.sync_live_participant_finished();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_participants;
