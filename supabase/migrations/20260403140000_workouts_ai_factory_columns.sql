-- P0: Mission Control Workout Factory — trainer AI rows on public.workouts (not workout_sets).

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS ai_chain_metadata jsonb;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'draft';

ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_source_check;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_source_check
  CHECK (source IN ('manual', 'ai_factory'));

ALTER TABLE public.workouts
  DROP CONSTRAINT IF EXISTS workouts_visibility_check;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_visibility_check
  CHECK (visibility IN ('draft', 'ready', 'assigned'));

COMMENT ON COLUMN public.workouts.source IS
  'manual | ai_factory — filter trainer library without JSON parsing.';

COMMENT ON COLUMN public.workouts.ai_chain_metadata IS
  'Vertex chain outputs + optional workoutConfig snapshot for AI-generated rows.';

COMMENT ON COLUMN public.workouts.visibility IS
  'Private lifecycle: draft → ready → assigned (client-facing). Distinct from workout_sets public publish.';

CREATE INDEX IF NOT EXISTS idx_workouts_trainer_source
  ON public.workouts (trainer_id, source);

CREATE INDEX IF NOT EXISTS idx_workouts_trainer_visibility
  ON public.workouts (trainer_id, visibility);
