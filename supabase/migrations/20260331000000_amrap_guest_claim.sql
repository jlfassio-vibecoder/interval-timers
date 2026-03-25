-- Enable secure guest-to-account AMRAP claim flow.
-- Guests can finish a session without auth; after sign-up we verify a one-time
-- claim token, attach participant.user_id, and persist results into:
-- - shared.amrap_session_results
-- - public.workout_logs

ALTER TABLE public.amrap_participants
ADD COLUMN IF NOT EXISTS guest_claim_token_hash text NULL;

-- Keep join_session behavior compatible while returning claim_token for guests.
DROP FUNCTION IF EXISTS public.join_session(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.join_session(
  p_session_id uuid,
  p_nickname text DEFAULT 'Anonymous',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
  v_session_id uuid;
  v_user_id uuid;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  -- Never trust client-provided p_user_id.
  v_user_id := auth.uid();

  IF NULLIF(trim(p_nickname), '') IS NULL THEN
    RAISE EXCEPTION 'Name or nickname is required';
  END IF;

  SELECT id INTO v_session_id
  FROM amrap_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT count(*) INTO v_count FROM amrap_participants WHERE session_id = p_session_id;
  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Session is full (max 6 participants)';
  END IF;

  IF v_user_id IS NULL THEN
    v_claim_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');
  ELSE
    v_claim_token := NULL;
    v_claim_hash := NULL;
  END IF;

  INSERT INTO amrap_participants (session_id, nickname, role, user_id, guest_claim_token_hash)
  VALUES (p_session_id, trim(p_nickname), 'joiner', v_user_id, v_claim_hash)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

-- Keep create_session behavior compatible while returning claim_token for guest hosts.
DROP FUNCTION IF EXISTS public.create_session(int, text, jsonb, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_host_nickname text DEFAULT 'Host',
  p_workout_list jsonb DEFAULT '[]',
  p_scheduled_start_at timestamptz DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_user_id uuid;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  -- Derive from auth.uid(); never trust client-provided p_user_id (prevents identity spoofing)
  v_user_id := auth.uid();

  v_host_token := gen_random_uuid()::text;
  IF v_user_id IS NULL THEN
    v_claim_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');
  ELSE
    v_claim_token := NULL;
    v_claim_hash := NULL;
  END IF;

  INSERT INTO amrap_sessions (host_token, duration_minutes, workout_list, state, time_left_sec, scheduled_start_at, created_by_user_id)
  VALUES (v_host_token, p_duration_minutes, p_workout_list, 'waiting', 10, p_scheduled_start_at, v_user_id)
  RETURNING id INTO v_session_id;

  INSERT INTO amrap_participants (session_id, nickname, role, user_id, guest_claim_token_hash)
  VALUES (
    v_session_id,
    COALESCE(NULLIF(trim(p_host_nickname), ''), 'Host'),
    'host',
    v_user_id,
    v_claim_hash
  )
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_amrap_guest_session(
  p_session_id uuid,
  p_participant_id uuid,
  p_claim_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, shared
AS $$
DECLARE
  v_uid uuid;
  v_existing_user_id uuid;
  v_existing_hash text;
  v_expected_hash text;
  v_session RECORD;
  v_rounds int;
  v_elapsed_arr int[];
  v_round_durations int[];
  v_i int;
  v_workout_name text;
  v_date date;
  v_duration_seconds int;
  v_dedupe_key text;
  v_goal_snapshot text[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF NULLIF(trim(p_claim_token), '') IS NULL THEN
    RAISE EXCEPTION 'Claim token required';
  END IF;

  SELECT user_id, guest_claim_token_hash
  INTO v_existing_user_id, v_existing_hash
  FROM amrap_participants
  WHERE id = p_participant_id
    AND session_id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  -- Prevent claiming another user's participant row.
  IF v_existing_user_id IS NOT NULL AND v_existing_user_id <> v_uid THEN
    RAISE EXCEPTION 'Session already claimed by another user';
  END IF;

  IF v_existing_hash IS NULL THEN
    RAISE EXCEPTION 'Session cannot be claimed';
  END IF;

  v_expected_hash := encode(digest(trim(p_claim_token), 'sha256'), 'hex');
  IF v_expected_hash <> v_existing_hash THEN
    RAISE EXCEPTION 'Invalid claim token';
  END IF;

  SELECT id, duration_minutes, workout_list, timer_segment, segment_index
  INTO v_session
  FROM amrap_sessions
  WHERE id = p_session_id AND state = 'finished'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session is not finished';
  END IF;

  IF v_session.timer_segment = 'free_workout' THEN
    RAISE EXCEPTION 'Free workout sessions cannot be claimed';
  END IF;

  UPDATE amrap_participants
  SET user_id = v_uid
  WHERE id = p_participant_id;

  SELECT fitness_goal_ranking
  INTO v_goal_snapshot
  FROM profiles
  WHERE id = v_uid;

  v_date := now()::date;
  v_duration_seconds := COALESCE(v_session.duration_minutes, 0) * 60;

  v_workout_name := NULL;
  IF jsonb_array_length(v_session.workout_list) > 0 THEN
    v_workout_name := trim(both from (v_session.workout_list->>0));
    IF v_workout_name = '' THEN
      v_workout_name := NULL;
    END IF;
  END IF;
  v_workout_name := COALESCE(v_workout_name, 'AMRAP With Friends');

  SELECT COALESCE(count(*), 0) INTO v_rounds
  FROM amrap_rounds
  WHERE session_id = p_session_id
    AND participant_id = p_participant_id
    AND segment_index = v_session.segment_index;

  SELECT array_agg(elapsed_sec_at_round ORDER BY round_index)
  INTO v_elapsed_arr
  FROM amrap_rounds
  WHERE session_id = p_session_id
    AND participant_id = p_participant_id
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

  INSERT INTO shared.amrap_session_results (
    user_id, session_id, participant_id, segment_index, total_rounds, workout_list,
    duration_minutes, completed_at, round_durations, workout_name
  )
  VALUES (
    v_uid, p_session_id, p_participant_id, v_session.segment_index, v_rounds, v_session.workout_list,
    v_session.duration_minutes, now(), v_round_durations, v_workout_name
  )
  ON CONFLICT (user_id, session_id, segment_index) DO UPDATE SET
    total_rounds = EXCLUDED.total_rounds,
    completed_at = EXCLUDED.completed_at,
    round_durations = EXCLUDED.round_durations,
    workout_name = EXCLUDED.workout_name;

  v_dedupe_key := 'amrap_with_friends:' || v_uid::text || ':' || p_session_id::text || ':' || v_session.segment_index::text;
  INSERT INTO public.workout_logs (
    user_id, workout_id, workout_name, date, effort, rating, notes,
    duration_seconds, rounds, source, handoff_dedupe_key, goal_snapshot
  ) VALUES (
    v_uid, NULL, v_workout_name, v_date, 5, 3, '',
    v_duration_seconds, v_rounds, 'amrap_with_friends', v_dedupe_key,
    CASE
      WHEN v_goal_snapshot IS NULL OR cardinality(v_goal_snapshot) = 0 THEN NULL
      ELSE v_goal_snapshot
    END
  )
  ON CONFLICT (handoff_dedupe_key) WHERE handoff_dedupe_key IS NOT NULL
  DO UPDATE SET
    rounds = EXCLUDED.rounds,
    duration_seconds = EXCLUDED.duration_seconds,
    goal_snapshot = EXCLUDED.goal_snapshot;

  -- One-time token invalidation after successful claim.
  UPDATE amrap_participants
  SET guest_claim_token_hash = NULL
  WHERE id = p_participant_id;

  RETURN jsonb_build_object('ok', true, 'session_id', p_session_id, 'participant_id', p_participant_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_amrap_guest_session(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_amrap_guest_session(uuid, uuid, text) TO authenticated;
