-- Log warm-up completion and close current warm-up segment.
-- Writes a workout_log row for trainer + all signed-in participants for analytics.

CREATE OR REPLACE FUNCTION public.trainer_live_activity_log_warmup(
  p_trainer_live_session_id uuid,
  p_exercises text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  v_activity_id uuid;
  v_segment RECORD;
  v_now timestamptz := clock_timestamp();
  v_duration_sec integer;
  v_notes text;
  v_date date;
  v_user_id uuid;
  v_logged_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trainer_user_id INTO v_trainer
  FROM public.trainer_live_sessions
  WHERE id = p_trainer_live_session_id;

  IF NOT FOUND OR v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO v_activity_id
  FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id
    AND status IN ('active', 'paused');

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'Start the activity timer first';
  END IF;

  SELECT s.*
  INTO v_segment
  FROM public.trainer_live_activity_segments s
  WHERE s.activity_session_id = v_activity_id
    AND s.ended_at IS NULL
  ORDER BY s.ordinal DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already_closed', true);
  END IF;

  IF v_segment.segment_type IS DISTINCT FROM 'warmup' THEN
    RAISE EXCEPTION 'Current segment is not warmup';
  END IF;

  v_duration_sec := GREATEST(0, extract(epoch FROM (v_now - v_segment.started_at))::integer);

  UPDATE public.trainer_live_activity_segments
  SET ended_at = v_now
  WHERE id = v_segment.id
    AND ended_at IS NULL;

  v_notes := CASE
    WHEN COALESCE(array_length(p_exercises, 1), 0) > 0 THEN
      'Warm-up completed exercises:' || E'\n- ' || array_to_string(p_exercises, E'\n- ')
    ELSE
      'Warm-up completed.'
  END;

  v_date := (v_now AT TIME ZONE 'UTC')::date;

  FOR v_user_id IN
    (
      SELECT trainer_user_id AS user_id
      FROM public.trainer_live_sessions
      WHERE id = p_trainer_live_session_id
      UNION
      SELECT p.user_id
      FROM public.trainer_live_participants p
      WHERE p.session_id = p_trainer_live_session_id
        AND p.user_id IS NOT NULL
    )
  LOOP
    INSERT INTO public.workout_logs (
      user_id,
      workout_id,
      workout_name,
      date,
      effort,
      rating,
      notes,
      duration_seconds,
      source,
      handoff_dedupe_key,
      is_active_rest
    )
    VALUES (
      v_user_id,
      NULL,
      COALESCE(NULLIF(trim(v_segment.label), ''), 'Warm-up'),
      v_date,
      3,
      3,
      v_notes,
      v_duration_sec,
      'trainer_live',
      'trainer_live_warmup:' || v_user_id::text || ':' || v_segment.id::text,
      false
    )
    ON CONFLICT (handoff_dedupe_key) WHERE (handoff_dedupe_key IS NOT NULL)
    DO UPDATE SET
      duration_seconds = EXCLUDED.duration_seconds,
      date = EXCLUDED.date,
      workout_name = EXCLUDED.workout_name,
      notes = EXCLUDED.notes;

    v_logged_count := v_logged_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'segment_id', v_segment.id,
    'duration_sec', v_duration_sec,
    'logged_user_count', v_logged_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_log_warmup(uuid, text[]) TO authenticated;
