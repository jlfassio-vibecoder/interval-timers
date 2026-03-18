-- Phase 5.7: Allow calendar creator to cancel AMRAP scheduled session (no host_token).
-- Enables "Clear scheduled" from HUD regardless of device/sessionStorage.

CREATE OR REPLACE FUNCTION cancel_amrap_session_for_creator(p_session_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM amrap_sessions
  WHERE id = p_session_id AND created_by_user_id = auth.uid();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_amrap_session_for_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_amrap_session_for_creator(uuid) TO authenticated;
