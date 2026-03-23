-- AMRAP: timer_segment (amrap vs free_workout) for synced post-recap free workout countdown

-- 1. Column
ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS timer_segment text NOT NULL DEFAULT 'amrap';

ALTER TABLE amrap_sessions
  DROP CONSTRAINT IF EXISTS amrap_sessions_timer_segment_check;

ALTER TABLE amrap_sessions
  ADD CONSTRAINT amrap_sessions_timer_segment_check
  CHECK (timer_segment IN ('amrap', 'free_workout'));

-- 2. Re-grant SELECT to include timer_segment
REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (
  id,
  duration_minutes,
  workout_list,
  state,
  time_left_sec,
  is_paused,
  started_at,
  created_at,
  scheduled_start_at,
  created_by_user_id,
  show_new_workout_modal,
  show_warmup_overlay,
  warmup_started_at,
  timer_segment
)
  ON amrap_sessions TO anon, authenticated;

-- 3. Replace update_session_state (add optional p_timer_segment; NULL = leave column unchanged)
DROP FUNCTION IF EXISTS update_session_state(uuid, text, text, int, boolean, timestamptz);

CREATE OR REPLACE FUNCTION update_session_state(
  p_session_id uuid,
  p_host_token text,
  p_state text,
  p_time_left_sec int,
  p_is_paused boolean,
  p_started_at timestamptz DEFAULT NULL,
  p_timer_segment text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE amrap_sessions
  SET
    state = p_state,
    time_left_sec = p_time_left_sec,
    is_paused = p_is_paused,
    started_at = COALESCE(p_started_at, started_at),
    timer_segment = COALESCE(p_timer_segment, timer_segment)
  WHERE id = p_session_id AND host_token = p_host_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_session_state(uuid, text, text, int, boolean, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_session_state(uuid, text, text, int, boolean, timestamptz, text) TO anon, authenticated;

-- 4. Host-only: start free workout from finished only
CREATE OR REPLACE FUNCTION start_free_workout_timer(
  p_session_id uuid,
  p_host_token text,
  p_duration_sec int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_duration_sec < 1 OR p_duration_sec > 7200 THEN
    RAISE EXCEPTION 'duration_sec must be between 1 and 7200';
  END IF;

  UPDATE amrap_sessions
  SET
    state = 'work',
    time_left_sec = p_duration_sec,
    is_paused = false,
    timer_segment = 'free_workout',
    started_at = now()
  WHERE id = p_session_id
    AND host_token = p_host_token
    AND state = 'finished';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION start_free_workout_timer(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_free_workout_timer(uuid, text, int) TO anon, authenticated;
