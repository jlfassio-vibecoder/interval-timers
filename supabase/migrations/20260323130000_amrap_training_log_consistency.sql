-- AMRAP training log consistency: skip free_workout persist, add warmup completion save
--
-- 1. persist_amrap_session_results: skip when timer_segment='free_workout' so free workout
--    finish does not overwrite AMRAP results with 0 rounds.
-- 2. persist_amrap_warmup_completion: host-only RPC to save Daily Warmup overlay completion
--    to workout_logs for all logged-in participants (source='amrap_with_friends_warmup').

-- 1. Update persist_amrap_session_results to skip free_workout
CREATE OR REPLACE FUNCTION public.persist_amrap_session_results(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shared
AS $$
DECLARE
  v_session RECORD;
  v_participant RECORD;
  v_rounds int;
  v_elapsed_arr int[];
  v_round_durations int[];
  v_i int;
  v_workout_name text;
  v_date date;
  v_duration_seconds int;
  v_dedupe_key text;
BEGIN
  SELECT id, duration_minutes, workout_list, timer_segment INTO v_session
  FROM amrap_sessions WHERE id = p_session_id AND state = 'finished';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Do not overwrite AMRAP results when free workout countdown finishes
  IF v_session.timer_segment = 'free_workout' THEN
    RETURN;
  END IF;

  -- Use completion timestamp date (persist runs when session becomes 'finished')
  v_date := (now())::date;
  v_duration_seconds := COALESCE(v_session.duration_minutes, 0) * 60;

  -- workout_name: first element of workout_list (jsonb array)
  v_workout_name := NULL;
  IF jsonb_array_length(v_session.workout_list) > 0 THEN
    v_workout_name := trim(both from (v_session.workout_list->>0));
    IF v_workout_name = '' THEN
      v_workout_name := NULL;
    END IF;
  END IF;
  v_workout_name := COALESCE(v_workout_name, 'AMRAP With Friends');

  FOR v_participant IN
    SELECT p.id, p.user_id FROM amrap_participants p
    WHERE p.session_id = p_session_id AND p.user_id IS NOT NULL
  LOOP
    SELECT COALESCE(count(*), 0) INTO v_rounds
    FROM amrap_rounds WHERE session_id = p_session_id AND participant_id = v_participant.id;

    -- Build round_durations from elapsed_sec_at_round ordered by round_index
    SELECT array_agg(elapsed_sec_at_round ORDER BY round_index)
    INTO v_elapsed_arr
    FROM amrap_rounds
    WHERE session_id = p_session_id AND participant_id = v_participant.id;

    v_round_durations := '{}';
    IF v_elapsed_arr IS NOT NULL AND array_length(v_elapsed_arr, 1) > 0 THEN
      IF array_length(v_elapsed_arr, 1) = 1 THEN
        v_round_durations := array[v_elapsed_arr[1]];
      ELSE
        v_round_durations := array[v_elapsed_arr[1]];
        FOR v_i IN 2..array_length(v_elapsed_arr, 1) LOOP
          v_round_durations := array_append(v_round_durations, v_elapsed_arr[v_i] - v_elapsed_arr[v_i - 1]);
        END LOOP;
      END IF;
    END IF;

    INSERT INTO shared.amrap_session_results (user_id, session_id, participant_id, total_rounds, workout_list, duration_minutes, completed_at, round_durations, workout_name)
    VALUES (v_participant.user_id, p_session_id, v_participant.id, v_rounds, v_session.workout_list, v_session.duration_minutes, now(), v_round_durations, v_workout_name)
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      total_rounds = EXCLUDED.total_rounds,
      completed_at = EXCLUDED.completed_at,
      round_durations = EXCLUDED.round_durations,
      workout_name = EXCLUDED.workout_name;

    -- Sync to workout_logs for Training Log (single source for completed workouts)
    v_dedupe_key := 'amrap_with_friends:' || v_participant.user_id::text || ':' || p_session_id::text;
    INSERT INTO public.workout_logs (
      user_id, workout_id, workout_name, date, effort, rating, notes,
      duration_seconds, rounds, source, handoff_dedupe_key
    ) VALUES (
      v_participant.user_id, NULL, v_workout_name, v_date, 5, 3, '',
      v_duration_seconds, v_rounds, 'amrap_with_friends', v_dedupe_key
    )
    ON CONFLICT (handoff_dedupe_key) WHERE handoff_dedupe_key IS NOT NULL
    DO UPDATE SET
      rounds = EXCLUDED.rounds,
      duration_seconds = EXCLUDED.duration_seconds;
  END LOOP;
END;
$$;

-- 2. RPC: persist warmup completion for all logged-in participants (host-only)
CREATE OR REPLACE FUNCTION public.persist_amrap_warmup_completion(
  p_session_id uuid,
  p_host_token text,
  p_duration_sec int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_participant RECORD;
  v_dedupe_key text;
  v_count int := 0;
BEGIN
  IF p_duration_sec < 1 OR p_duration_sec > 7200 THEN
    RAISE EXCEPTION 'duration_sec must be between 1 and 7200';
  END IF;

  -- Verify host
  IF NOT EXISTS (
    SELECT 1 FROM amrap_sessions
    WHERE id = p_session_id AND host_token = p_host_token
  ) THEN
    RETURN 0;
  END IF;

  FOR v_participant IN
    SELECT p.id, p.user_id FROM amrap_participants p
    WHERE p.session_id = p_session_id AND p.user_id IS NOT NULL
  LOOP
    v_dedupe_key := 'amrap_with_friends_warmup:' || v_participant.user_id::text || ':' || p_session_id::text;
    INSERT INTO public.workout_logs (
      user_id, workout_id, workout_name, date, effort, rating, notes,
      duration_seconds, rounds, source, handoff_dedupe_key
    ) VALUES (
      v_participant.user_id, NULL, 'Daily Warm-Up', (now())::date, 5, 3, '',
      p_duration_sec, NULL, 'amrap_with_friends_warmup', v_dedupe_key
    )
    ON CONFLICT (handoff_dedupe_key) WHERE handoff_dedupe_key IS NOT NULL
    DO UPDATE SET
      duration_seconds = EXCLUDED.duration_seconds;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.persist_amrap_warmup_completion(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_amrap_warmup_completion(uuid, text, int) TO authenticated;
