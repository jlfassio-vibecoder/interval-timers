-- P2 Performance Lab: scheduled placement for coach assignments (drag-to-reschedule).
-- Program templates stay immutable; instances point at client_coach_assignments.

CREATE TABLE IF NOT EXISTS public.client_coach_schedule_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.client_coach_assignments (id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccsi_client_scheduled
  ON public.client_coach_schedule_instances (client_user_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_ccsi_assignment
  ON public.client_coach_schedule_instances (assignment_id);

COMMENT ON TABLE public.client_coach_schedule_instances IS
  'Per-occurrence schedule for coach assignments; Mission Control APIs write via service role.';

ALTER TABLE public.client_coach_schedule_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccsi_select_as_client" ON public.client_coach_schedule_instances;
DROP POLICY IF EXISTS "ccsi_select_as_trainer_mc" ON public.client_coach_schedule_instances;

CREATE POLICY "ccsi_select_as_client"
  ON public.client_coach_schedule_instances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

CREATE POLICY "ccsi_select_as_trainer_mc"
  ON public.client_coach_schedule_instances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_user_id AND public.is_mission_control_staff());
