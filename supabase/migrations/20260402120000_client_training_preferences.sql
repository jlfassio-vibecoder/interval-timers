-- Trainer-recommended active program per client (Mission Control Performance Lab).
-- Composite key matches TDD: (client_user_id, trainer_user_id).

CREATE TABLE IF NOT EXISTS public.client_training_preferences (
  client_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recommended_active_program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_user_id, trainer_user_id)
);

CREATE INDEX IF NOT EXISTS client_training_preferences_trainer_idx
  ON public.client_training_preferences (trainer_user_id);

CREATE INDEX IF NOT EXISTS client_training_preferences_client_idx
  ON public.client_training_preferences (client_user_id);

COMMENT ON TABLE public.client_training_preferences IS
  'Trainer HUD: recommended active program id for a client; read by client app when valid enrollment exists.';
