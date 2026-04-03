-- Fix: back from AMRAP should keep countdown_timer shell (Video + Intervals), not video_only.
-- Safe to apply after 20260430210000; replaces function body.

CREATE OR REPLACE FUNCTION public.trainer_live_return_to_main_video(p_trainer_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'none',
    interval_wrapper_config = NULL
  WHERE id = p_trainer_live_session_id
    AND trainer_user_id = v_uid
    AND status = 'active'
    AND shell = 'countdown_timer';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Session not found, ended, not authorized, or not a Video + Intervals room';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
