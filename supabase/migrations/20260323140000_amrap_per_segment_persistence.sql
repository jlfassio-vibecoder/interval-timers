-- Per-segment AMRAP training log: each AMRAP workout and free workout saved as its own row.
--
-- 1. segment_index on amrap_sessions (incremented when host selects New Workout)
-- 2. segment_index on amrap_rounds (scopes rounds per workout)
-- 3. log_round: read segment from session, insert with segment_index
-- 4. update_session_workout: increment segment_index when state='finished'
-- 5. free_workout_duration_sec on amrap_sessions, set by start_free_workout_timer
-- 6. segment_index on amrap_session_results, unique (user_id, session_id, segment_index)
-- 7. persist_amrap_session_results: filter rounds by segment, use segment in dedupe key
-- 8. persist_free_workout_completion: new RPC, called from trigger when timer_segment='free_workout'
-- 9. on_amrap_session_finished: branch to persist_free_workout when free_workout

-- 1. Add segment_index to amrap_sessions
ALTER TABLE public.amrap_sessions
  ADD COLUMN IF NOT EXISTS segment_index int NOT NULL DEFAULT 0;

-- 2. Add free_workout_duration_sec (set when free workout starts; used by persist on finish)
ALTER TABLE public.amrap_sessions
  ADD COLUMN IF NOT EXISTS free_workout_duration_sec int;

-- Re-grant SELECT to include new columns
REVOKE ALL ON public.amrap_sessions FROM anon, authenticated;
GRANT SELECT (
  id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at,
  created_at, scheduled_start_at, created_by_user_id, show_new_workout_modal,
  show_warmup_overlay, warmup_started_at, timer_segment, segment_index, free_workout_duration_sec
) ON public.amrap_sessions TO anon, authenticated;

-- 3. Update start_free_workout_timer to set free_workout_duration_sec
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

  UPDATE public.amrap_sessions
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

-- 4. Add segment_index to amrap_rounds
ALTER TABLE public.amrap_rounds
  ADD COLUMN IF NOT EXISTS segment_index int NOT NULL DEFAULT 0;

-- 5. Drop old unique constraint, add new one with segment_index
ALTER TABLE public.amrap_rounds
  DROP CONSTRAINT IF EXISTS amrap_rounds_session_participant_round_unique;

ALTER TABLE public.amrap_rounds
  ADD CONSTRAINT amrap_rounds_session_participant_segment_round_unique
  UNIQUE (session_id, participant_id, segment_index, round_index);

-- 6. Update log_round to use segment_index from session
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
  -- Lock session row and get segment_index
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

-- 7. Update update_session_workout to increment segment_index when state='finished'
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

  UPDATE public.amrap_sessions
  SET
    workout_list = p_workout_list,
    duration_minutes = p_duration_minutes,
    segment_index = CASE WHEN v_state = 'finished' THEN segment_index + 1 ELSE segment_index END
  WHERE id = p_session_id AND host_token = p_host_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 8. Add segment_index to amrap_session_results
ALTER TABLE shared.amrap_session_results
  ADD COLUMN IF NOT EXISTS segment_index int NOT NULL DEFAULT 0;

UPDATE shared.amrap_session_results SET segment_index = 0 WHERE segment_index IS NULL;

-- Drop old unique (user_id, session_id), add new (user_id, session_id, segment_index)
ALTER TABLE shared.amrap_session_results
  DROP CONSTRAINT IF EXISTS amrap_session_results_user_id_session_id_key;

ALTER TABLE shared.amrap_session_results
  ADD CONSTRAINT amrap_session_results_user_session_segment_key
  UNIQUE (user_id, session_id, segment_index);

-- 9. Replace persist_amrap_session_results with segment-scoped logic
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

-- 10. Create persist_free_workout_completion (uses free_workout_duration_sec from session)
CREATE OR REPLACE FUNCTION public.persist_free_workout_completion(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_participant RECORD;
  v_duration_sec int;
  v_dedupe_key text;
  v_free_index bigint;
BEGIN
  SELECT free_workout_duration_sec INTO v_duration_sec
  FROM amrap_sessions
  WHERE id = p_session_id AND state = 'finished' AND timer_segment = 'free_workout';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_duration_sec := COALESCE(v_duration_sec, 0);
  IF v_duration_sec < 1 THEN
    RETURN;
  END IF;

  v_free_index := extract(epoch from now())::bigint;

  FOR v_participant IN
    SELECT p.id, p.user_id FROM amrap_participants p
    WHERE p.session_id = p_session_id AND p.user_id IS NOT NULL
  LOOP
    v_dedupe_key := 'amrap_with_friends_free:' || v_participant.user_id::text || ':' || p_session_id::text || ':' || v_free_index::text;
    INSERT INTO public.workout_logs (
      user_id, workout_id, workout_name, date, effort, rating, notes,
      duration_seconds, rounds, source, handoff_dedupe_key
    ) VALUES (
      v_participant.user_id, NULL, 'Free workout', (now())::date, 5, 3, '',
      v_duration_sec, NULL, 'amrap_with_friends_free', v_dedupe_key
    )
    ON CONFLICT (handoff_dedupe_key) WHERE handoff_dedupe_key IS NOT NULL
    DO NOTHING;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.persist_free_workout_completion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_free_workout_completion(uuid) TO authenticated, service_role;

-- 11. Update on_amrap_session_finished trigger to call persist_free_workout when timer_segment='free_workout'
CREATE OR REPLACE FUNCTION public.on_amrap_session_finished()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM 'finished' AND NEW.state = 'finished' THEN
    IF NEW.timer_segment = 'free_workout' THEN
      PERFORM persist_free_workout_completion(NEW.id);
    ELSE
      PERFORM persist_amrap_session_results(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 12. Update get_amrap_session_results RPC to return segment_index
DROP FUNCTION IF EXISTS public.get_amrap_session_results(int);
CREATE OR REPLACE FUNCTION public.get_amrap_session_results(p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  segment_index int,
  total_rounds int,
  workout_list jsonb,
  duration_minutes int,
  completed_at timestamptz,
  round_durations int[],
  workout_name text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, shared
AS $$
  SELECT
    r.id,
    r.session_id,
    r.segment_index,
    r.total_rounds,
    r.workout_list,
    r.duration_minutes,
    r.completed_at,
    COALESCE(r.round_durations, '{}'),
    r.workout_name
  FROM shared.amrap_session_results r
  WHERE r.user_id = auth.uid()
  ORDER BY r.completed_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

-- 13. Backfill workout_logs: migrate existing amrap_with_friends rows to segment 0 key format
-- Old key: amrap_with_friends:{user_id}:{session_id}
-- New key: amrap_with_friends:{user_id}:{session_id}:0
UPDATE public.workout_logs
SET handoff_dedupe_key = handoff_dedupe_key || ':0'
WHERE source = 'amrap_with_friends'
  AND handoff_dedupe_key IS NOT NULL
  AND handoff_dedupe_key !~ ':[0-9]+$';
