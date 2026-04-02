-- RLS for client_coach_assignments. Mission Control APIs use service role and bypass RLS.

ALTER TABLE public.client_coach_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_coach_assignments_select_as_client" ON public.client_coach_assignments;
DROP POLICY IF EXISTS "client_coach_assignments_all_as_trainer" ON public.client_coach_assignments;

CREATE POLICY "client_coach_assignments_select_as_client"
  ON public.client_coach_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

-- Client dismiss uses /api/me/* with service role after auth (no direct client UPDATE).

CREATE POLICY "client_coach_assignments_all_as_trainer"
  ON public.client_coach_assignments
  FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_user_id)
  WITH CHECK (auth.uid() = trainer_user_id);
