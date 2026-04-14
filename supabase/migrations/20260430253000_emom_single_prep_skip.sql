-- Trainer Live EMOM: one prep countdown (warmup only). Remove extra 10s "setup" slice from skip_prep alignment.

CREATE OR REPLACE FUNCTION public.trainer_live_emom_skip_prep(p_emom_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
  v_warm int;
  v_started timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.trainer_user_id, es.warmup_seconds, es.started_at
  INTO v_tl, v_warm, v_started
  FROM public.emom_sessions es
  INNER JOIN public.trainer_live_sessions s ON s.id = es.trainer_live_session_id
  WHERE es.id = p_emom_session_id;

  IF v_tl IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_started IS NULL THEN
    RAISE EXCEPTION 'Start the EMOM timer first';
  END IF;

  UPDATE public.emom_sessions
  SET
    started_at = clock_timestamp() - (v_warm * interval '1 second'),
    paused_at = NULL,
    pause_accum_ms = 0
  WHERE id = p_emom_session_id AND status = 'active';

  RETURN jsonb_build_object('ok', true);
END;
$$;
