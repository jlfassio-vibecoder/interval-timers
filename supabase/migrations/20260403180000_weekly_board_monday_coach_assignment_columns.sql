-- Follow-up to P4 (PR #131 Copilot review): DB invariants app layer now enforces.
-- Monday: ISO weekday 1; coach_note/due_on/exercise_slug only on exercise rows.

ALTER TABLE public.client_weekly_activity_boards
  DROP CONSTRAINT IF EXISTS client_weekly_activity_boards_week_start_monday_ck;

ALTER TABLE public.client_weekly_activity_boards
  ADD CONSTRAINT client_weekly_activity_boards_week_start_monday_ck
  CHECK (EXTRACT(ISODOW FROM week_start_date) = 1);

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
      AND exercise_slug IS NULL
      AND coach_note IS NULL
      AND due_on IS NULL
    )
  );
