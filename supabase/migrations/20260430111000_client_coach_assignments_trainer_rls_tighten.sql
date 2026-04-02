-- PR #128: Replace trainer FOR ALL with Mission Control SELECT-only. Prior policy allowed any
-- authenticated user to INSERT rows where trainer_user_id = auth.uid(), enabling poisoned
-- assignments; payload APIs use service role and must not be the sole gate.

DROP POLICY IF EXISTS "client_coach_assignments_all_as_trainer" ON public.client_coach_assignments;

DROP POLICY IF EXISTS "client_coach_assignments_select_as_trainer" ON public.client_coach_assignments;

CREATE POLICY "client_coach_assignments_select_as_trainer"
  ON public.client_coach_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_user_id AND public.is_mission_control_staff());
