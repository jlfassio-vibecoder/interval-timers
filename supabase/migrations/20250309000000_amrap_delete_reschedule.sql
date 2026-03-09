-- AMRAP: allow host to delete or reschedule sessions via RPC (validates host_token)

CREATE OR REPLACE FUNCTION delete_session(
  p_session_id uuid,
  p_host_token text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM amrap_sessions
  WHERE id = p_session_id AND host_token = p_host_token;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION reschedule_session(
  p_session_id uuid,
  p_host_token text,
  p_scheduled_start_at timestamptz
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE amrap_sessions
  SET scheduled_start_at = p_scheduled_start_at
  WHERE id = p_session_id AND host_token = p_host_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Allow anon/authenticated to call these RPCs (required for Supabase schema cache)
GRANT EXECUTE ON FUNCTION delete_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reschedule_session(uuid, text, timestamptz) TO anon, authenticated;
