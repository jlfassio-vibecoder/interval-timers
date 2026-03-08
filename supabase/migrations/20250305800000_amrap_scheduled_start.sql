-- Optional scheduled start time for AMRAP sessions; countdown (max 10 min) and auto-Start at that time.

ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz DEFAULT NULL;

-- Recreate create_session to accept optional scheduled_start_at (drop + create to change signature).
DROP FUNCTION IF EXISTS create_session(int, text, jsonb);

CREATE OR REPLACE FUNCTION create_session(
  p_duration_minutes int,
  p_host_nickname text DEFAULT 'Host',
  p_workout_list jsonb DEFAULT '[]',
  p_scheduled_start_at timestamptz DEFAULT NULL
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
  INSERT INTO amrap_sessions (host_token, duration_minutes, workout_list, state, time_left_sec, scheduled_start_at)
  VALUES (v_host_token, p_duration_minutes, p_workout_list, 'waiting', 10, p_scheduled_start_at)
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

-- Extend column-level SELECT to include scheduled_start_at (re-grant full list).
REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at, scheduled_start_at)
  ON amrap_sessions TO anon, authenticated;
