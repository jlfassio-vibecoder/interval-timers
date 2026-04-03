-- Trainer Live: require workout + duration on attach (WorkoutPicker contract).
-- Replaces single-arg trainer_live_attach_amrap_session(uuid).

DROP FUNCTION IF EXISTS public.trainer_live_attach_amrap_session(uuid);

CREATE OR REPLACE FUNCTION public.trainer_live_attach_amrap_session(
  p_trainer_live_session_id uuid,
  p_duration_minutes int,
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
  v_amrap_id uuid;
  v_existing uuid;
  v_host_token text;
  v_host_participant_id uuid;
  v_display text;
  v_created jsonb;
  v_tl_trainer uuid;
  v_elem jsonb;
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

  -- Idempotent: already amrap with a valid linked session (params ignored)
  IF v_kind = 'amrap' AND v_cfg IS NOT NULL AND v_cfg ? 'amrap_session_id' THEN
    v_existing := NULL;
    BEGIN
      v_existing := (v_cfg->>'amrap_session_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_existing := NULL;
    END;
    IF v_existing IS NOT NULL THEN
      SELECT s.host_token INTO v_host_token
      FROM public.amrap_sessions s
      WHERE s.id = v_existing;
      IF FOUND THEN
        -- Match create/attach success shape: host participant id for stored credentials (same as non-idempotent path).
        SELECT p.id INTO v_host_participant_id
        FROM public.amrap_participants p
        WHERE p.session_id = v_existing AND p.role = 'host' AND p.user_id = v_uid
        LIMIT 1;
        IF v_host_participant_id IS NULL THEN
          SELECT p.id INTO v_host_participant_id
          FROM public.amrap_participants p
          WHERE p.session_id = v_existing AND p.role = 'host'
          ORDER BY p.joined_at ASC
          LIMIT 1;
        END IF;
        RETURN jsonb_build_object(
          'amrap_session_id', v_existing,
          'host_token', v_host_token,
          'amrap_participant_id', v_host_participant_id,
          'already_attached', true
        );
      END IF;
    END IF;
  END IF;

  -- Create path: enforce WorkoutPicker contract at DB level
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

  SELECT COALESCE(
    NULLIF(trim(t.display_name), ''),
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.username), ''),
    'Host'
  ) INTO v_display
  FROM public.profiles p
  LEFT JOIN public.trainers t ON t.user_id = p.id
  WHERE p.id = v_uid;

  IF v_display IS NULL THEN
    v_display := 'Host';
  END IF;

  v_created := public.create_session(p_duration_minutes, v_display, p_workout_list, NULL, NULL);
  v_amrap_id := (v_created->>'session_id')::uuid;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'amrap',
    interval_wrapper_config = jsonb_build_object('amrap_session_id', v_amrap_id)
  WHERE id = p_trainer_live_session_id;

  RETURN jsonb_build_object(
    'amrap_session_id', v_amrap_id,
    'host_token', v_created->>'host_token',
    'amrap_participant_id', v_created->>'participant_id',
    'already_attached', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_attach_amrap_session(uuid, int, jsonb) TO authenticated;
