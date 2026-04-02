-- RLS for client_training_preferences (Copilot PR #127). Service role still bypasses RLS for Mission Control APIs.

ALTER TABLE public.client_training_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_training_preferences_select_as_client" ON public.client_training_preferences;
DROP POLICY IF EXISTS "client_training_preferences_all_as_trainer" ON public.client_training_preferences;

-- Client reads own recommendation rows (supports user-JWT Supabase client on /api/me/*).
CREATE POLICY "client_training_preferences_select_as_client"
  ON public.client_training_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

-- Trainer manages rows where they are the trainer (future direct client SDK; server uses service role).
CREATE POLICY "client_training_preferences_all_as_trainer"
  ON public.client_training_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_user_id)
  WITH CHECK (auth.uid() = trainer_user_id);
