-- EMOM Trainer Live shell: clock starts only after trainer taps Start; pause/resume/finish; prep skip.
-- Safe on existing DBs: widens started_at, adds columns, replaces RPCs.

ALTER TABLE public.emom_sessions
  ALTER COLUMN started_at DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pause_accum_ms bigint NOT NULL DEFAULT 0 CHECK (pause_accum_ms >= 0);

COMMENT ON COLUMN public.emom_sessions.paused_at IS 'When set, logical clock freezes at this wall time for all clients.';
COMMENT ON COLUMN public.emom_sessions.pause_accum_ms IS 'Total milliseconds of paused time subtracted from the logical timeline.';

-- New sessions: trainer must call trainer_live_emom_start_clock before the EMOM timer runs.
CREATE OR REPLACE FUNCTION public.trainer_live_activity_begin_emom_segment(
  p_trainer_live_session_id uuid,
  p_label text DEFAULT 'EMOM',
  p_round_count int DEFAULT 10,
  p_workout_list jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shell text;
  v_tl_trainer uuid;
  v_activity_id uuid;
  v_ord int;
  v_seg_id uuid;
  v_emom_id uuid;
  v_rc int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_workout_list IS NULL OR jsonb_typeof(p_workout_list) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_workout_list must be a JSON array';
  END IF;

  SELECT shell, trainer_user_id
  INTO v_shell, v_tl_trainer
  FROM public.trainer_live_sessions
  WHERE id = p_trainer_live_session_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or ended';
  END IF;

  IF v_tl_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_shell IS DISTINCT FROM 'countdown_timer' THEN
    RAISE EXCEPTION 'Interval tools require Video + Intervals layout';
  END IF;

  SELECT id INTO v_activity_id
  FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id
    AND status IN ('active', 'paused');

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'Start the activity timer first';
  END IF;

  v_rc := COALESCE(p_round_count, 10);
  IF v_rc < 1 OR v_rc > 120 THEN
    RAISE EXCEPTION 'round_count must be between 1 and 120';
  END IF;

  INSERT INTO public.emom_sessions (
    created_by,
    trainer_live_session_id,
    round_count,
    warmup_seconds,
    workout_list,
    status,
    started_at,
    paused_at,
    pause_accum_ms
  )
  VALUES (
    v_uid,
    p_trainer_live_session_id,
    v_rc,
    10,
    COALESCE(p_workout_list, '[]'::jsonb),
    'active',
    NULL,
    NULL,
    0
  )
  RETURNING id INTO v_emom_id;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'emom',
    interval_wrapper_config = jsonb_build_object('emom_session_id', v_emom_id)
  WHERE id = p_trainer_live_session_id;

  PERFORM public._trainer_live_close_open_segment(v_activity_id);

  SELECT COALESCE(MAX(ordinal), -1) + 1 INTO v_ord
  FROM public.trainer_live_activity_segments
  WHERE activity_session_id = v_activity_id;

  INSERT INTO public.trainer_live_activity_segments (
    activity_session_id, ordinal, segment_type, label, started_at, emom_session_id
  )
  VALUES (
    v_activity_id,
    v_ord,
    'emom',
    COALESCE(NULLIF(trim(p_label), ''), 'EMOM'),
    clock_timestamp(),
    v_emom_id
  )
  RETURNING id INTO v_seg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'segment_id', v_seg_id,
    'emom_session_id', v_emom_id,
    'ordinal', v_ord
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- trainer_live_emom_start_clock — trainer starts the shared EMOM timeline
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_emom_start_clock(p_emom_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.trainer_user_id
  INTO v_tl
  FROM public.emom_sessions es
  INNER JOIN public.trainer_live_sessions s ON s.id = es.trainer_live_session_id
  WHERE es.id = p_emom_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMOM session not found';
  END IF;

  IF v_tl IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.emom_sessions
  SET
    started_at = clock_timestamp(),
    paused_at = NULL,
    pause_accum_ms = 0
  WHERE id = p_emom_session_id
    AND started_at IS NULL
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMOM session already started or not active';
  END IF;

  RETURN jsonb_build_object('ok', true, 'emom_session_id', p_emom_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_emom_start_clock(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Pause / resume / finish / skip prep (trainer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_emom_pause(p_emom_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.trainer_user_id
  INTO v_tl
  FROM public.emom_sessions es
  INNER JOIN public.trainer_live_sessions s ON s.id = es.trainer_live_session_id
  WHERE es.id = p_emom_session_id;

  IF v_tl IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.emom_sessions
  SET paused_at = clock_timestamp()
  WHERE id = p_emom_session_id
    AND status = 'active'
    AND started_at IS NOT NULL
    AND paused_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot pause';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_emom_resume(p_emom_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.trainer_user_id
  INTO v_tl
  FROM public.emom_sessions es
  INNER JOIN public.trainer_live_sessions s ON s.id = es.trainer_live_session_id
  WHERE es.id = p_emom_session_id;

  IF v_tl IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.emom_sessions es
  SET
    pause_accum_ms = es.pause_accum_ms
      + (EXTRACT(EPOCH FROM (clock_timestamp() - es.paused_at)) * 1000)::bigint,
    paused_at = NULL
  WHERE es.id = p_emom_session_id
    AND es.paused_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not paused';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_emom_finish_session(p_emom_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.trainer_user_id
  INTO v_tl
  FROM public.emom_sessions es
  INNER JOIN public.trainer_live_sessions s ON s.id = es.trainer_live_session_id
  WHERE es.id = p_emom_session_id;

  IF v_tl IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.emom_sessions
  SET status = 'ended', paused_at = NULL
  WHERE id = p_emom_session_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot finish';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Jump from warmup/setup to minute 1 (aligns logical time to start of main block).
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
    started_at = clock_timestamp() - ((v_warm + 10) * interval '1 second'),
    paused_at = NULL,
    pause_accum_ms = 0
  WHERE id = p_emom_session_id AND status = 'active';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_emom_pause(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_emom_resume(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_emom_finish_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_emom_skip_prep(uuid) TO authenticated;

-- Require a running clock before logging rounds
CREATE OR REPLACE FUNCTION public.trainer_live_emom_log_round(
  p_emom_session_id uuid,
  p_participant_id uuid,
  p_round_index int,
  p_work_seconds int,
  p_completed boolean,
  p_logged_weight text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl_sid uuid;
  v_round_count int;
  v_st text;
  v_sess uuid;
  v_p_user uuid;
  v_row_id uuid;
  v_started timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_round_index IS NULL OR p_round_index < 1 THEN
    RAISE EXCEPTION 'Invalid round_index';
  END IF;

  IF p_work_seconds IS NULL OR p_work_seconds < 0 OR p_work_seconds > 60 THEN
    RAISE EXCEPTION 'work_seconds must be between 0 and 60';
  END IF;

  SELECT es.trainer_live_session_id, es.round_count, es.status, es.started_at
  INTO v_tl_sid, v_round_count, v_st, v_started
  FROM public.emom_sessions es
  WHERE es.id = p_emom_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMOM session not found';
  END IF;

  IF v_started IS NULL THEN
    RAISE EXCEPTION 'EMOM timer has not started yet';
  END IF;

  IF v_st IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EMOM session is not active';
  END IF;

  IF p_round_index > v_round_count THEN
    RAISE EXCEPTION 'round_index exceeds round_count for this session';
  END IF;

  SELECT p.session_id, p.user_id
  INTO v_sess, v_p_user
  FROM public.trainer_live_participants p
  WHERE p.id = p_participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_sess IS DISTINCT FROM v_tl_sid THEN
    RAISE EXCEPTION 'Participant is not in this EMOM session';
  END IF;

  IF v_p_user IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.emom_round_logs (
    emom_session_id,
    participant_id,
    round_index,
    work_seconds,
    completed,
    logged_weight
  )
  VALUES (
    p_emom_session_id,
    p_participant_id,
    p_round_index,
    p_work_seconds,
    COALESCE(p_completed, false),
    p_logged_weight
  )
  ON CONFLICT ON CONSTRAINT emom_round_logs_session_participant_round_unique
  DO UPDATE SET
    work_seconds = EXCLUDED.work_seconds,
    completed = EXCLUDED.completed,
    logged_weight = COALESCE(EXCLUDED.logged_weight, emom_round_logs.logged_weight),
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row_id,
    'emom_session_id', p_emom_session_id,
    'participant_id', p_participant_id,
    'round_index', p_round_index
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_emom_log_round_for_participant(
  p_trainer_live_session_id uuid,
  p_participant_id uuid,
  p_emom_session_id uuid,
  p_round_index int,
  p_work_seconds int,
  p_completed boolean,
  p_logged_weight text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tl_sid uuid;
  v_round_count int;
  v_st text;
  v_sess uuid;
  v_row_id uuid;
  v_started timestamptz;
BEGIN
  IF NOT public.trainer_live_verify_token_targets(p_trainer_live_session_id, p_participant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_round_index IS NULL OR p_round_index < 1 THEN
    RAISE EXCEPTION 'Invalid round_index';
  END IF;

  IF p_work_seconds IS NULL OR p_work_seconds < 0 OR p_work_seconds > 60 THEN
    RAISE EXCEPTION 'work_seconds must be between 0 and 60';
  END IF;

  SELECT es.trainer_live_session_id, es.round_count, es.status, es.started_at
  INTO v_tl_sid, v_round_count, v_st, v_started
  FROM public.emom_sessions es
  WHERE es.id = p_emom_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMOM session not found';
  END IF;

  IF v_started IS NULL THEN
    RAISE EXCEPTION 'EMOM timer has not started yet';
  END IF;

  IF v_tl_sid IS DISTINCT FROM p_trainer_live_session_id THEN
    RAISE EXCEPTION 'EMOM session does not belong to this live session';
  END IF;

  IF v_st IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EMOM session is not active';
  END IF;

  IF p_round_index > v_round_count THEN
    RAISE EXCEPTION 'round_index exceeds round_count for this session';
  END IF;

  SELECT p.session_id
  INTO v_sess
  FROM public.trainer_live_participants p
  WHERE p.id = p_participant_id;

  IF NOT FOUND OR v_sess IS DISTINCT FROM v_tl_sid THEN
    RAISE EXCEPTION 'Participant is not in this EMOM session';
  END IF;

  INSERT INTO public.emom_round_logs (
    emom_session_id,
    participant_id,
    round_index,
    work_seconds,
    completed,
    logged_weight
  )
  VALUES (
    p_emom_session_id,
    p_participant_id,
    p_round_index,
    p_work_seconds,
    COALESCE(p_completed, false),
    p_logged_weight
  )
  ON CONFLICT ON CONSTRAINT emom_round_logs_session_participant_round_unique
  DO UPDATE SET
    work_seconds = EXCLUDED.work_seconds,
    completed = EXCLUDED.completed,
    logged_weight = COALESCE(EXCLUDED.logged_weight, emom_round_logs.logged_weight),
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row_id,
    'emom_session_id', p_emom_session_id,
    'participant_id', p_participant_id,
    'round_index', p_round_index
  );
END;
$$;
