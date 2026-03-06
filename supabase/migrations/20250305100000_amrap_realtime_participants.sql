-- Enable Realtime for amrap_participants so clients see when someone joins

ALTER TABLE amrap_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE amrap_participants;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
