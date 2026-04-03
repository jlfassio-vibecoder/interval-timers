-- P5: Coach assignment type challenge (Performance Lab → Challenge Factory).

ALTER TABLE public.client_coach_assignments
  DROP CONSTRAINT IF EXISTS client_coach_assignments_assignment_type_check;

ALTER TABLE public.client_coach_assignments
  ADD CONSTRAINT client_coach_assignments_assignment_type_check
  CHECK (assignment_type IN ('program', 'workout', 'wod', 'exercise', 'challenge'));
