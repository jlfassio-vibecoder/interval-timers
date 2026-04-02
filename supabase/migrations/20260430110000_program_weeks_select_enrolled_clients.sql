-- HUD calendar + schedule resolver load week content via getProgramWithSchedule → program_weeks.
-- Only trainers could read program_weeks; enrolled clients saw empty schedule and no calendar events.

CREATE POLICY "Enrolled clients can read program weeks for assigned programs"
  ON public.program_weeks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_programs up
      WHERE up.program_id = program_weeks.program_id
        AND up.user_id = auth.uid()
        AND up.status = 'active'
    )
  );

COMMENT ON POLICY "Enrolled clients can read program weeks for assigned programs" ON public.program_weeks IS
  'Allows trainees to load week JSON for programs they are actively enrolled in (calendar, Continue, schedule).';
