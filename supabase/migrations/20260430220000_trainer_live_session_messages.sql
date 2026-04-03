-- In-room chat for Trainer Live (trainer_live_sessions), keyed by trainer live session + participant.
-- Access via SECURITY DEFINER RPCs using existing trainer_live_verify_token_targets (join link model).

CREATE TABLE IF NOT EXISTS public.trainer_live_session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.trainer_live_sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trainer_live_participants (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tlsm_session_created
  ON public.trainer_live_session_messages (session_id, created_at);

ALTER TABLE public.trainer_live_session_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.trainer_live_session_messages FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.trainer_live_list_session_messages(
  p_session_id uuid,
  p_caller_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_caller_participant_id IS NULL THEN
    RAISE EXCEPTION 'participant required';
  END IF;

  IF NOT public.trainer_live_verify_token_targets(p_session_id, p_caller_participant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
      FROM (
        SELECT
          m.id,
          m.session_id,
          m.participant_id,
          m.body,
          m.created_at,
          p.display_name AS author_display_name
        FROM public.trainer_live_session_messages m
        INNER JOIN public.trainer_live_participants p ON p.id = m.participant_id
        WHERE m.session_id = p_session_id
      ) x
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_post_session_message(
  p_session_id uuid,
  p_participant_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_body text := trim(both from COALESCE(p_body, ''));
  v_id uuid;
  v_created timestamptz;
BEGIN
  IF char_length(v_body) < 1 OR char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'Message must be 1–500 characters';
  END IF;

  IF NOT public.trainer_live_verify_token_targets(p_session_id, p_participant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.trainer_live_session_messages (session_id, participant_id, body)
  VALUES (p_session_id, p_participant_id, v_body)
  RETURNING id, created_at INTO v_id, v_created;

  RETURN jsonb_build_object(
    'id', v_id,
    'session_id', p_session_id,
    'participant_id', p_participant_id,
    'body', v_body,
    'created_at', v_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_list_session_messages(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_post_session_message(uuid, uuid, text) TO anon, authenticated;

ALTER TABLE public.trainer_live_session_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_live_session_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
