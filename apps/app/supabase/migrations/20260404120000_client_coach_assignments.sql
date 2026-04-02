-- P1: Coach-assigned programs, workouts, and WODs (Performance Lab → client HUD).

CREATE TABLE IF NOT EXISTS public.client_coach_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN ('program', 'workout', 'wod')),
  resource_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  starts_on date,
  expires_on date,
  title_snapshot text NOT NULL DEFAULT 'Untitled',
  dismissed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_coach_assignments_trainer_client_idx
  ON public.client_coach_assignments (trainer_user_id, client_user_id);

CREATE INDEX IF NOT EXISTS client_coach_assignments_client_idx
  ON public.client_coach_assignments (client_user_id);

COMMENT ON TABLE public.client_coach_assignments IS
  'Trainer assignments surfaced to clients (programs enroll + workout/WOD payloads).';
