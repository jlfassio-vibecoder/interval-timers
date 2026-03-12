-- Phase 3 handoff: add columns for timer-session prefill (Tabata, AMRAP, Daily Warm-Up).
-- effort/rating remain NOT NULL; handoff inserts use effort=5, rating=3.

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS rounds integer,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS handoff_dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_handoff_dedupe
  ON public.workout_logs (handoff_dedupe_key)
  WHERE handoff_dedupe_key IS NOT NULL;
