-- Clients invited to trainer programs could not SELECT those programs (only is_public or trainer-owned
-- rows were readable). Client code (e.g. getTrainerForUser) needs trainer_id for assigned programs.
-- PostgREST .single() on 0 visible rows returns 406 (PGRST116).

DROP POLICY IF EXISTS "Enrolled clients can read assigned program" ON public.programs;

CREATE POLICY "Enrolled clients can read assigned program"
  ON public.programs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_programs up
      WHERE up.program_id = programs.id
        AND up.user_id = auth.uid()
        AND up.status = 'active'
    )
  );

COMMENT ON POLICY "Enrolled clients can read assigned program" ON public.programs IS
  'Allows trainees to read rows for programs they are actively enrolled in (trainer-assigned, non-public).';
