-- AMRAP free-workout training log + HUD RPC + dedupe backfill.
--
-- Segment schema, log_round, update_session_workout, and segment-scoped
-- persist_amrap_session_results are defined in 20260323130000 (same deploy step
-- as warmup RPC) so there is no window where AMRAP finish writes wrong round counts
-- or pre-segment dedupe keys.

-- 1. persist_free_workout_completion (uses free_workout_duration_sec from session)
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

  -- Millisecond precision avoids collision when two free workouts finish in same second
  v_free_index := (extract(epoch from clock_timestamp()) * 1000)::bigint;

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

-- 2. on_amrap_session_finished: branch to persist_free_workout when timer_segment='free_workout'
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

-- 3. get_amrap_session_results returns segment_index
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

-- 4. Backfill workout_logs: migrate existing amrap_with_friends rows to segment 0 key format
UPDATE public.workout_logs wl
SET handoff_dedupe_key = wl.handoff_dedupe_key || ':0'
WHERE wl.source = 'amrap_with_friends'
  AND wl.handoff_dedupe_key IS NOT NULL
  AND wl.handoff_dedupe_key !~ ':[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM public.workout_logs w2
    WHERE w2.handoff_dedupe_key = wl.handoff_dedupe_key || ':0'
  );
