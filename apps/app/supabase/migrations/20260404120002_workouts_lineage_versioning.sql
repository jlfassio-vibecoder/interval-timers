-- Trainer library: version lineages (multiple rows per logical workout history).
-- Version 20260404120002: must not reuse 20260404120000 (already used by client_coach_assignments).

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS lineage_id uuid;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS version_index integer NOT NULL DEFAULT 1;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS supersedes_workout_id uuid REFERENCES public.workouts (id) ON DELETE SET NULL;

UPDATE public.workouts
SET lineage_id = id
WHERE lineage_id IS NULL;

ALTER TABLE public.workouts
  ALTER COLUMN lineage_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workouts_lineage_version_unique
  ON public.workouts (lineage_id, version_index);

CREATE INDEX IF NOT EXISTS idx_workouts_trainer_lineage
  ON public.workouts (trainer_id, lineage_id);

COMMENT ON COLUMN public.workouts.lineage_id IS
  'Stable id for all versions of the same logical trainer workout.';

COMMENT ON COLUMN public.workouts.version_index IS
  'Monotonic version number within lineage_id (1, 2, 3, …).';

COMMENT ON COLUMN public.workouts.supersedes_workout_id IS
  'Previous workouts row when this row was created as a new version.';

-- Default: new rows without lineage_id use id as their own lineage (single-version lineage).
CREATE OR REPLACE FUNCTION public.workouts_before_insert_lineage_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lineage_id IS NULL THEN
    NEW.lineage_id := NEW.id;
  END IF;
  IF NEW.version_index IS NULL OR NEW.version_index < 1 THEN
    NEW.version_index := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workouts_before_insert_lineage_defaults ON public.workouts;

CREATE TRIGGER workouts_before_insert_lineage_defaults
  BEFORE INSERT ON public.workouts
  FOR EACH ROW
  EXECUTE PROCEDURE public.workouts_before_insert_lineage_defaults();
