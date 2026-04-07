-- Phase C: optional link from coach schedule instances to trainer Live room (group / class identity).

ALTER TABLE public.client_coach_schedule_instances
  ADD COLUMN IF NOT EXISTS trainer_live_session_id uuid NULL
    REFERENCES public.trainer_live_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ccsi_trainer_live_session
  ON public.client_coach_schedule_instances (trainer_user_id, trainer_live_session_id)
  WHERE trainer_live_session_id IS NOT NULL;

COMMENT ON COLUMN public.client_coach_schedule_instances.trainer_live_session_id IS
  'Optional link to a shared Live session; used for unified calendar grouping and conflict rules.';
