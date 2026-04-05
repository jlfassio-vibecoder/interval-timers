-- Optional reaction_key on Trainer Live session messages (Lucide preset quick-reactions).
-- Must run after 20260430220000_trainer_live_session_messages.sql (lexical migration order).

ALTER TABLE public.trainer_live_session_messages
  ADD COLUMN IF NOT EXISTS reaction_key text NULL;

COMMENT ON COLUMN public.trainer_live_session_messages.reaction_key IS
  'Stable preset id for icon mapping; validated in trainer_live_post_session_message.';

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
          m.reaction_key,
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

DROP FUNCTION IF EXISTS public.trainer_live_post_session_message(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.trainer_live_post_session_message(
  p_session_id uuid,
  p_participant_id uuid,
  p_body text,
  p_reaction_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_body text := trim(both from COALESCE(p_body, ''));
  v_rx text := nullif(trim(both from lower(COALESCE(p_reaction_key, ''))), '');
  v_id uuid;
  v_created timestamptz;
BEGIN
  IF char_length(v_body) < 1 OR char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'Message must be 1–500 characters';
  END IF;

  IF NOT public.trainer_live_verify_token_targets(p_session_id, p_participant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_rx IS NOT NULL THEN
    IF v_rx NOT IN (
      'leaderboard_climb',
      'leaderboard_hot',
      'leaderboard_medal',
      'intensity_fire',
      'intensity_zap',
      'intensity_lift',
      'motivation_heart',
      'motivation_nice',
      'motivation_sparkles',
      'motivation_hands'
    ) THEN
      RAISE EXCEPTION 'Invalid reaction_key';
    END IF;
  END IF;

  INSERT INTO public.trainer_live_session_messages (session_id, participant_id, body, reaction_key)
  VALUES (p_session_id, p_participant_id, v_body, v_rx)
  RETURNING id, created_at INTO v_id, v_created;

  RETURN jsonb_build_object(
    'id', v_id,
    'session_id', p_session_id,
    'participant_id', p_participant_id,
    'body', v_body,
    'reaction_key', v_rx,
    'created_at', v_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_post_session_message(uuid, uuid, text, text) TO anon, authenticated;
