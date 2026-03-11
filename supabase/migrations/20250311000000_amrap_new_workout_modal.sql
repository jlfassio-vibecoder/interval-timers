-- AMRAP: host can open/close New Workout modal (visible to all) and update session workout

-- 1. Add show_new_workout_modal column to amrap_sessions
ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS show_new_workout_modal boolean DEFAULT false;

-- 2. Re-grant SELECT to include show_new_workout_modal
REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at, scheduled_start_at, created_by_user_id, show_new_workout_modal)
  ON amrap_sessions TO anon, authenticated;

-- 3. RPC: set_new_workout_modal (host only)
CREATE OR REPLACE FUNCTION set_new_workout_modal(
  p_session_id uuid,
  p_host_token text,
  p_open boolean
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
  SET show_new_workout_modal = p_open
  WHERE id = p_session_id AND host_token = p_host_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_new_workout_modal(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_new_workout_modal(uuid, text, boolean) TO anon, authenticated;

-- 4. RPC: update_session_workout (host only)
CREATE OR REPLACE FUNCTION update_session_workout(
  p_session_id uuid,
  p_host_token text,
  p_workout_list jsonb,
  p_duration_minutes int
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
  SET workout_list = p_workout_list,
      duration_minutes = p_duration_minutes
  WHERE id = p_session_id AND host_token = p_host_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_session_workout(uuid, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_session_workout(uuid, text, jsonb, int) TO anon, authenticated;
