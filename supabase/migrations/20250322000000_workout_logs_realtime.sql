-- workout_logs: timer app handoff (Tabata, Daily Warm-Up, etc.); HUD calendar + history.
ALTER TABLE public.workout_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_logs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
