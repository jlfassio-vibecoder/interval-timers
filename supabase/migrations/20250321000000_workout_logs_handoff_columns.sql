-- Add handoff columns to workout_logs for timer sessions (Tabata, AMRAP, Daily Warm-Up).
-- Required for calendar-unified getTimerLogEventsForRange (filter by source, select duration_seconds, rounds).
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS rounds integer,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS handoff_dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_handoff_dedupe
  ON public.workout_logs (handoff_dedupe_key)
  WHERE handoff_dedupe_key IS NOT NULL;
