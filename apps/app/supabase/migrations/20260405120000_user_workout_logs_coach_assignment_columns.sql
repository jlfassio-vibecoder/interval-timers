-- Coach-assigned workout completion analytics: link set-level logs to assignment + resource.

ALTER TABLE public.user_workout_logs
  ADD COLUMN IF NOT EXISTS coach_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS coach_resource_id uuid,
  ADD COLUMN IF NOT EXISTS coach_assignment_type text;

ALTER TABLE public.user_workout_logs
  DROP CONSTRAINT IF EXISTS user_workout_logs_coach_assignment_type_check;

ALTER TABLE public.user_workout_logs
  ADD CONSTRAINT user_workout_logs_coach_assignment_type_check
  CHECK (
    coach_assignment_type IS NULL
    OR coach_assignment_type IN ('workout', 'wod')
  );

CREATE INDEX IF NOT EXISTS idx_user_workout_logs_coach_assignment
  ON public.user_workout_logs (coach_assignment_id)
  WHERE coach_assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_workout_logs_coach_resource
  ON public.user_workout_logs (coach_resource_id)
  WHERE coach_resource_id IS NOT NULL;

COMMENT ON COLUMN public.user_workout_logs.coach_assignment_id IS
  'client_coach_assignments.id at completion (analytics).';
COMMENT ON COLUMN public.user_workout_logs.coach_resource_id IS
  'Snapshot of client_coach_assignments.resource_id (e.g. public.workouts.id).';
COMMENT ON COLUMN public.user_workout_logs.coach_assignment_type IS
  'Assignment kind when logged from coach flow (workout vs wod).';
