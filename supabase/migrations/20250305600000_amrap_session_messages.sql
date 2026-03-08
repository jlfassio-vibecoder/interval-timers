-- Session message board: participants can post short messages; Realtime for live updates.

CREATE TABLE IF NOT EXISTS amrap_session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES amrap_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES amrap_participants(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amrap_session_messages_session ON amrap_session_messages(session_id);

ALTER TABLE amrap_session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amrap_session_messages_select"
  ON amrap_session_messages FOR SELECT
  USING (true);

CREATE POLICY "amrap_session_messages_insert"
  ON amrap_session_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM amrap_participants p
      WHERE p.id = amrap_session_messages.participant_id
        AND p.session_id = amrap_session_messages.session_id
    )
  );

GRANT SELECT, INSERT ON amrap_session_messages TO anon;
GRANT SELECT, INSERT ON amrap_session_messages TO authenticated;

ALTER TABLE amrap_session_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE amrap_session_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
