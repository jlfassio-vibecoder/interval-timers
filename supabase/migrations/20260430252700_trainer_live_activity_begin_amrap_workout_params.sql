-- Trainer Live: activity AMRAP segment uses WorkoutPicker duration + list (parity with trainer_live_attach_amrap_session).

DROP FUNCTION IF EXISTS public.trainer_live_activity_begin_amrap_segment(uuid, text);

CREATE OR REPLACE FUNCTION public.trainer_live_activity_begin_amrap_segment(
  p_trainer_live_session_id uuid,
  p_duration_minutes int,
  p_workout_list jsonb,
  p_label text DEFAULT 'AMRAP'
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
  v_created jsonb;
  v_amrap_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_display text;
  v_elem jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'p_duration_minutes must be between 1 and 180';
  END IF;

  IF p_workout_list IS NULL OR jsonb_typeof(p_workout_list) != 'array' THEN
    RAISE EXCEPTION 'p_workout_list must be a JSON array';
  END IF;

  IF jsonb_array_length(p_workout_list) < 1 THEN
    RAISE EXCEPTION 'p_workout_list must contain at least one exercise';
  END IF;

  FOR v_elem IN SELECT jsonb_array_elements(p_workout_list)
  LOOP
    IF jsonb_typeof(v_elem) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Each workout entry must be a string';
    END IF;
    IF v_elem #>> '{}' IS NULL OR length(trim(v_elem #>> '{}')) < 1 THEN
      RAISE EXCEPTION 'Each workout entry must be a non-empty string';
    END IF;
  END LOOP;

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

  SELECT COALESCE(
    NULLIF(trim(t.display_name), ''),
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.username), ''),
    'Host'
  ) INTO v_display
  FROM public.profiles p
  LEFT JOIN public.trainers t ON t.user_id = p.id
  WHERE p.id = v_uid;

  v_created := public.create_session(
    p_duration_minutes,
    COALESCE(NULLIF(trim(v_display), ''), 'Host'),
    p_workout_list,
    NULL,
    NULL
  );
  v_amrap_id := (v_created->>'session_id')::uuid;
  v_host_token := v_created->>'host_token';
  v_participant_id := v_created->>'participant_id';

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'amrap',
    interval_wrapper_config = jsonb_build_object('amrap_session_id', v_amrap_id)
  WHERE id = p_trainer_live_session_id;

  PERFORM public._trainer_live_close_open_segment(v_activity_id);

  SELECT COALESCE(MAX(ordinal), -1) + 1 INTO v_ord
  FROM public.trainer_live_activity_segments
  WHERE activity_session_id = v_activity_id;

  INSERT INTO public.trainer_live_activity_segments (
    activity_session_id, ordinal, segment_type, label, started_at, amrap_session_id
  )
  VALUES (
    v_activity_id, v_ord, 'amrap', COALESCE(NULLIF(trim(p_label), ''), 'AMRAP'), clock_timestamp(), v_amrap_id
  )
  RETURNING id INTO v_seg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'segment_id', v_seg_id,
    'amrap_session_id', v_amrap_id,
    'host_token', v_host_token,
    'amrap_participant_id', v_participant_id,
    'ordinal', v_ord
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_begin_amrap_segment(uuid, int, jsonb, text) TO authenticated;
