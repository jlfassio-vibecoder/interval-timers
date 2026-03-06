-- Require host nickname on create, non-empty nickname on join (RPC only)

-- Parameter order (duration, host_nickname, workout_list) matches schema cache / client call order.
CREATE OR REPLACE FUNCTION create_session(
  p_duration_minutes int,
  p_host_nickname text DEFAULT 'Host',
  p_workout_list jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
BEGIN
  v_host_token := gen_random_uuid()::text;
  INSERT INTO amrap_sessions (host_token, duration_minutes, workout_list, state, time_left_sec)
  VALUES (v_host_token, p_duration_minutes, p_workout_list, 'waiting', 10)
  RETURNING id INTO v_session_id;

  INSERT INTO amrap_participants (session_id, nickname, role)
  VALUES (
    v_session_id,
    COALESCE(NULLIF(trim(p_host_nickname), ''), 'Host'),
    'host'
  )
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION join_session(p_session_id uuid, p_nickname text DEFAULT 'Anonymous')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
BEGIN
  IF NULLIF(trim(p_nickname), '') IS NULL THEN
    RAISE EXCEPTION 'Name or nickname is required';
  END IF;

  SELECT count(*) INTO v_count FROM amrap_participants WHERE session_id = p_session_id;
  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Session is full (max 6 participants)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM amrap_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  INSERT INTO amrap_participants (session_id, nickname, role)
  VALUES (p_session_id, trim(p_nickname), 'joiner')
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;
