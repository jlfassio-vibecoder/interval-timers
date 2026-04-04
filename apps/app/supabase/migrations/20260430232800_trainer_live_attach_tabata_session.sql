-- Trainer Live: attach Tabata from lobby (no activity segment). Parallel to trainer_live_attach_amrap_session.
-- See docs/TRAINER_LIVE_TABATA_WRAPPER_TDD.md

CREATE OR REPLACE FUNCTION public.trainer_live_attach_tabata_session(
  p_trainer_live_session_id uuid,
  p_round_count int,
  p_workout_list jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shell text;
  v_kind text;
  v_cfg jsonb;
  v_existing uuid;
  v_tl_trainer uuid;
  v_elem jsonb;
  v_tabata_id uuid;
  v_rc int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT shell, interval_wrapper_kind, interval_wrapper_config, trainer_user_id
  INTO v_shell, v_kind, v_cfg, v_tl_trainer
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
    RAISE EXCEPTION 'Interval tools require countdown_timer layout';
  END IF;

  -- Idempotent: already tabata with a valid linked row for this trainer live session (params ignored)
  IF v_kind = 'tabata' AND v_cfg IS NOT NULL AND v_cfg ? 'tabata_session_id' THEN
    v_existing := NULL;
    BEGIN
      v_existing := (v_cfg->>'tabata_session_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_existing := NULL;
    END;
    IF v_existing IS NOT NULL THEN
      SELECT ts.id INTO v_tabata_id
      FROM public.tabata_sessions ts
      WHERE ts.id = v_existing AND ts.trainer_live_session_id = p_trainer_live_session_id;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'tabata_session_id', v_existing,
          'already_attached', true
        );
      END IF;
    END IF;
  END IF;

  v_rc := COALESCE(p_round_count, 8);
  IF v_rc < 1 OR v_rc > 32 THEN
    RAISE EXCEPTION 'p_round_count must be between 1 and 32';
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

  INSERT INTO public.tabata_sessions (
    created_by,
    trainer_live_session_id,
    work_seconds,
    rest_seconds,
    round_count,
    workout_list,
    state
  )
  VALUES (
    v_uid,
    p_trainer_live_session_id,
    20,
    10,
    v_rc,
    p_workout_list,
    '{"phase":"idle","version":1}'::jsonb
  )
  RETURNING id INTO v_tabata_id;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'tabata',
    interval_wrapper_config = jsonb_build_object('tabata_session_id', v_tabata_id)
  WHERE id = p_trainer_live_session_id;

  RETURN jsonb_build_object(
    'tabata_session_id', v_tabata_id,
    'already_attached', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_attach_tabata_session(uuid, int, jsonb) TO authenticated;
