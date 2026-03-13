-- AMRAP: host can open/close Daily Warmup overlay (visible to all) and start warmup timer

-- 1. Add show_warmup_overlay and warmup_started_at columns to amrap_sessions
ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS show_warmup_overlay boolean DEFAULT false;

ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz;

-- 2. Re-grant SELECT to include new columns
REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at, scheduled_start_at, created_by_user_id, show_new_workout_modal, show_warmup_overlay, warmup_started_at)
  ON amrap_sessions TO anon, authenticated;

-- 3. RPC: set_warmup_overlay (host only)
CREATE OR REPLACE FUNCTION set_warmup_overlay(
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
  SET show_warmup_overlay = p_open,
      warmup_started_at = CASE WHEN NOT p_open THEN NULL ELSE warmup_started_at END
  WHERE id = p_session_id AND host_token = p_host_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_warmup_overlay(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_warmup_overlay(uuid, text, boolean) TO anon, authenticated;

-- 4. RPC: start_warmup (host only)
CREATE OR REPLACE FUNCTION start_warmup(
  p_session_id uuid,
  p_host_token text
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
  SET warmup_started_at = now()
  WHERE id = p_session_id AND host_token = p_host_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION start_warmup(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_warmup(uuid, text) TO anon, authenticated;
