-- Enable Realtime for HUD ScheduleZone and HistoryZone.
-- user_workout_logs: program session completion, calendar; shared.amrap_session_results: AMRAP results for history.

ALTER TABLE public.user_workout_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_workout_logs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE shared.amrap_session_results REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared.amrap_session_results;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
