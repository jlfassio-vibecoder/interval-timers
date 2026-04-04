-- Mission Control: parent row for AI factory multi-session programs with unparsed WorkoutSetTemplate snapshot.

CREATE TABLE IF NOT EXISTS public.trainer_workout_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  raw_workout_set jsonb NOT NULL,
  ai_chain_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_workout_series_trainer_id
  ON public.trainer_workout_series (trainer_id);

COMMENT ON TABLE public.trainer_workout_series IS
  'Trainer-owned snapshot of a generated workout set; child public.workouts rows are sessions with session_index.';

COMMENT ON COLUMN public.trainer_workout_series.raw_workout_set IS
  'Full WorkoutSetTemplate JSON as generated (canonical preview source).';

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS workout_series_id uuid REFERENCES public.trainer_workout_series (id) ON DELETE SET NULL;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS session_index integer;

CREATE INDEX IF NOT EXISTS idx_workouts_workout_series_session
  ON public.workouts (workout_series_id, session_index);

COMMENT ON COLUMN public.workouts.workout_series_id IS
  'When set, this row is session session_index of the linked trainer_workout_series.';

COMMENT ON COLUMN public.workouts.session_index IS
  '0-based index within trainer_workout_series.raw_workout_set.workouts.';

ALTER TABLE public.trainer_workout_series ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_workout_series TO authenticated;

DROP POLICY IF EXISTS "Trainers can manage own trainer_workout_series" ON public.trainer_workout_series;

CREATE POLICY "Trainers can manage own trainer_workout_series"
  ON public.trainer_workout_series
  FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);
