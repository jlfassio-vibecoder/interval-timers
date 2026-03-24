-- AMRAP training log consistency + segment-safe persist (single step; avoids wrong data
-- if a session finishes between migrations).
--
-- 1. segment_index / free_workout_duration_sec on amrap_sessions; grants
-- 2. start_free_workout_timer sets free_workout_duration_sec (used by later migration)
-- 3. segment_index on amrap_rounds + unique constraint
-- 4. log_round / update_session_workout use segment_index
-- 5. segment_index on shared.amrap_session_results + unique constraint
-- 6. persist_amrap_session_results: skip free_workout; segment-scoped rounds + dedupe keys
-- 7. persist_amrap_warmup_completion RPC

-- 1. Add segment columns on amrap_sessions (required before segment-scoped persist)
ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS segment_index int NOT NULL DEFAULT 0;

ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS free_workout_duration_sec int;

REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (
  id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at,
  created_at, scheduled_start_at, created_by_user_id, show_new_workout_modal,
  show_warmup_overlay, warmup_started_at, timer_segment, segment_index, free_workout_duration_sec
) ON amrap_sessions TO anon, authenticated;

-- 2. start_free_workout_timer: persist duration for free-workout completion (see 20260323140000)
CREATE OR REPLACE FUNCTION public.start_free_workout_timer(
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
  v_updated int;
BEGIN
  IF p_duration_sec < 1 OR p_duration_sec > 7200 THEN
    RAISE EXCEPTION 'duration_sec must be between 1 and 7200';
  END IF;

  UPDATE amrap_sessions
  SET
    state = 'work',
    time_left_sec = p_duration_sec,
    is_paused = false,
    timer_segment = 'free_workout',
    started_at = now(),
    free_workout_duration_sec = p_duration_sec
  WHERE id = p_session_id
    AND host_token = p_host_token
    AND state = 'finished';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 3. segment_index on amrap_rounds + unique (session, participant, segment, round)
ALTER TABLE amrap_rounds
  ADD COLUMN IF NOT EXISTS segment_index int NOT NULL DEFAULT 0;

ALTER TABLE amrap_rounds
  DROP CONSTRAINT IF EXISTS amrap_rounds_session_participant_round_unique;

ALTER TABLE amrap_rounds
  DROP CONSTRAINT IF EXISTS amrap_rounds_session_participant_segment_round_unique;

ALTER TABLE amrap_rounds
  ADD CONSTRAINT amrap_rounds_session_participant_segment_round_unique
  UNIQUE (session_id, participant_id, segment_index, round_index);

-- 4. log_round: scope rounds to session.segment_index
CREATE OR REPLACE FUNCTION public.log_round(
  p_session_id uuid,
  p_participant_id uuid,
  p_elapsed_sec_at_round int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segment_index int;
  v_next_index int;
  v_new_id uuid;
BEGIN
  SELECT segment_index INTO v_segment_index
  FROM amrap_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT COALESCE(MAX(round_index), 0) + 1 INTO v_next_index
  FROM amrap_rounds
  WHERE session_id = p_session_id
    AND participant_id = p_participant_id
    AND segment_index = v_segment_index;

  INSERT INTO amrap_rounds (session_id, participant_id, segment_index, round_index, elapsed_sec_at_round)
  VALUES (p_session_id, p_participant_id, v_segment_index, v_next_index, p_elapsed_sec_at_round)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('round_index', v_next_index, 'id', v_new_id);
END;
$$;

-- 5. update_session_workout: bump segment_index when starting a new workout from finished
CREATE OR REPLACE FUNCTION public.update_session_workout(
  p_session_id uuid,
  p_host_token text,
  p_workout_list jsonb,
  p_duration_minutes int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated int;
  v_state text;
BEGIN
  SELECT state INTO v_state FROM amrap_sessions
  WHERE id = p_session_id AND host_token = p_host_token;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE amrap_sessions
  SET
    workout_list = p_workout_list,
    duration_minutes = p_duration_minutes,
    segment_index = CASE WHEN v_state = 'finished' THEN segment_index + 1 ELSE segment_index END
  WHERE id = p_session_id AND host_token = p_host_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 6. shared.amrap_session_results: segment_index + unique (user_id, session_id, segment_index)
ALTER TABLE shared.amrap_session_results
  ADD COLUMN IF NOT EXISTS segment_index int NOT NULL DEFAULT 0;

UPDATE shared.amrap_session_results SET segment_index = 0 WHERE segment_index IS NULL;

ALTER TABLE shared.amrap_session_results
  DROP CONSTRAINT IF EXISTS amrap_session_results_user_id_session_id_key;

ALTER TABLE shared.amrap_session_results
  DROP CONSTRAINT IF EXISTS amrap_session_results_user_session_segment_key;

ALTER TABLE shared.amrap_session_results
  ADD CONSTRAINT amrap_session_results_user_session_segment_key
  UNIQUE (user_id, session_id, segment_index);

-- 7. persist_amrap_session_results: free_workout skip + segment-scoped rounds and dedupe keys
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
  SELECT id, duration_minutes, workout_list, timer_segment, segment_index INTO v_session
  FROM amrap_sessions WHERE id = p_session_id AND state = 'finished';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_session.timer_segment = 'free_workout' THEN
    RETURN;
  END IF;

  v_date := (now())::date;
  v_duration_seconds := COALESCE(v_session.duration_minutes, 0) * 60;

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
    FROM amrap_rounds
    WHERE session_id = p_session_id
      AND participant_id = v_participant.id
      AND segment_index = v_session.segment_index;

    SELECT array_agg(elapsed_sec_at_round ORDER BY round_index)
    INTO v_elapsed_arr
    FROM amrap_rounds
    WHERE session_id = p_session_id
      AND participant_id = v_participant.id
      AND segment_index = v_session.segment_index;

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

    INSERT INTO shared.amrap_session_results (user_id, session_id, participant_id, segment_index, total_rounds, workout_list, duration_minutes, completed_at, round_durations, workout_name)
    VALUES (v_participant.user_id, p_session_id, v_participant.id, v_session.segment_index, v_rounds, v_session.workout_list, v_session.duration_minutes, now(), v_round_durations, v_workout_name)
    ON CONFLICT (user_id, session_id, segment_index) DO UPDATE SET
      total_rounds = EXCLUDED.total_rounds,
      completed_at = EXCLUDED.completed_at,
      round_durations = EXCLUDED.round_durations,
      workout_name = EXCLUDED.workout_name;

    v_dedupe_key := 'amrap_with_friends:' || v_participant.user_id::text || ':' || p_session_id::text || ':' || v_session.segment_index::text;
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

-- 8. RPC: persist warmup completion for all logged-in participants (host-only)
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
GRANT EXECUTE ON FUNCTION public.persist_amrap_warmup_completion(uuid, text, int) TO anon;
