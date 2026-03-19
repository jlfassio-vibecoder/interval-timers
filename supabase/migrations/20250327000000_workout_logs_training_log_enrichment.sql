-- Enrich workout_logs for Training Log app (filtering, analytics, goals).
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- Handoff apps (Tabata, AMRAP, Daily Warm-Up) omit these; Training Log can backfill from source.

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS workout_type text,
  ADD COLUMN IF NOT EXISTS workout_format text,
  ADD COLUMN IF NOT EXISTS intensity text,
  ADD COLUMN IF NOT EXISTS focus_area text,
  ADD COLUMN IF NOT EXISTS is_active_rest boolean DEFAULT false;

-- Optional: structured exercise logging for users who log workout detail.
CREATE TABLE IF NOT EXISTS public.workout_log_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  phase text CHECK (phase IN ('warmup', 'main', 'cooldown')),
  exercise_name text NOT NULL,
  sets int,
  reps int,
  duration_seconds int,
  weight_lbs numeric,
  notes text,
  order_index int NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_log_exercises_log
  ON public.workout_log_exercises(workout_log_id);
