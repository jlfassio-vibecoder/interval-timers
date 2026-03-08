-- Enable Realtime for amrap_rounds so host and participants see new rounds (e.g. Log Round) live.

ALTER TABLE amrap_rounds REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE amrap_rounds;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
