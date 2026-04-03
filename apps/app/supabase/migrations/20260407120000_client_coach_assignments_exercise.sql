-- P4: Exercise (education) assignments — extend client_coach_assignments.

ALTER TABLE public.client_coach_assignments
  DROP CONSTRAINT IF EXISTS client_coach_assignments_assignment_type_check;

ALTER TABLE public.client_coach_assignments
  ADD CONSTRAINT client_coach_assignments_assignment_type_check
  CHECK (assignment_type IN ('program', 'workout', 'wod', 'exercise'));

ALTER TABLE public.client_coach_assignments
  ALTER COLUMN resource_id DROP NOT NULL;

ALTER TABLE public.client_coach_assignments
  ADD COLUMN IF NOT EXISTS exercise_slug text,
  ADD COLUMN IF NOT EXISTS coach_note text,
  ADD COLUMN IF NOT EXISTS due_on date;

ALTER TABLE public.client_coach_assignments
  DROP CONSTRAINT IF EXISTS client_coach_assignments_resource_or_exercise_ck;

ALTER TABLE public.client_coach_assignments
  ADD CONSTRAINT client_coach_assignments_resource_or_exercise_ck
  CHECK (
    (
      assignment_type = 'exercise'
      AND exercise_slug IS NOT NULL
      AND length(trim(exercise_slug)) > 0
      AND resource_id IS NULL
    )
    OR (
      assignment_type <> 'exercise'
      AND resource_id IS NOT NULL
    )
  );

COMMENT ON COLUMN public.client_coach_assignments.exercise_slug IS
  'For assignment_type exercise: slug into /exercises/[slug]/learn (generated_exercises).';
