-- Enforce session_index pairing, non-negativity, and uniqueness per trainer_workout_series.

ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_session_index_nonnegative;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_session_index_nonnegative
  CHECK (session_index IS NULL OR session_index >= 0);

ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_series_session_pairing;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_series_session_pairing
  CHECK (
    (workout_series_id IS NULL AND session_index IS NULL)
    OR (workout_series_id IS NOT NULL AND session_index IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_workout_series_session_unique
  ON public.workouts (workout_series_id, session_index)
  WHERE workout_series_id IS NOT NULL AND session_index IS NOT NULL;
