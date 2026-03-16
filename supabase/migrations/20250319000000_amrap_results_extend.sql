-- Extend shared.amrap_session_results for HUD: round_durations (consistency chart), workout_name (display/grouping).
-- Update persist_amrap_session_results to compute and store them.

-- 1. Add columns to shared.amrap_session_results
ALTER TABLE shared.amrap_session_results
  ADD COLUMN IF NOT EXISTS round_durations int[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS workout_name text;

-- 2. workout_name from first exercise (DB-side; no library match)
COMMENT ON COLUMN shared.amrap_session_results.workout_name IS 'Display name: first exercise from workout_list or NULL';
COMMENT ON COLUMN shared.amrap_session_results.round_durations IS 'Seconds per round; enables consistency chart and analytics';

-- 3. Replace persist_amrap_session_results to compute round_durations and workout_name
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
BEGIN
  SELECT id, duration_minutes, workout_list INTO v_session
  FROM amrap_sessions WHERE id = p_session_id AND state = 'finished';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- workout_name: first element of workout_list (jsonb array)
  v_workout_name := NULL;
  IF jsonb_array_length(v_session.workout_list) > 0 THEN
    v_workout_name := trim(both from (v_session.workout_list->>0));
    IF v_workout_name = '' THEN
      v_workout_name := NULL;
    END IF;
  END IF;

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
  END LOOP;
END;
$$;
