-- P3 Performance Lab: async trainer–client message board (chronological; API writes via service role).

CREATE TABLE IF NOT EXISTS public.trainer_client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('trainer', 'client')),
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_client_messages_author_matches_dyad CHECK (
    (
      author_user_id = trainer_user_id
      AND author_role = 'trainer'
    )
    OR (
      author_user_id = client_user_id
      AND author_role = 'client'
    )
  ),
  CONSTRAINT trainer_client_messages_distinct_participants CHECK (trainer_user_id <> client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tcm_trainer_client_created
  ON public.trainer_client_messages (trainer_user_id, client_user_id, created_at DESC, id DESC);

COMMENT ON TABLE public.trainer_client_messages IS
  'Coach–client async messages; Mission Control + /api/me write via service role; SELECT via RLS.';

ALTER TABLE public.trainer_client_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tcm_select_as_client" ON public.trainer_client_messages;
DROP POLICY IF EXISTS "tcm_select_as_trainer_mc" ON public.trainer_client_messages;

CREATE POLICY "tcm_select_as_client"
  ON public.trainer_client_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

CREATE POLICY "tcm_select_as_trainer_mc"
  ON public.trainer_client_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_user_id AND public.is_mission_control_staff());
