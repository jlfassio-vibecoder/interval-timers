-- HUD Integration: trial, user linkage, session ownership
-- 1. Add amrap_trial_ends_at to profiles
-- 2. Add user_id to amrap_participants, created_by_user_id to amrap_sessions
-- 3. Update create_session and join_session RPCs to accept optional user_id
-- 4. Trigger to set trial on new profile

-- Profiles: amrap trial (nullable; set on insert via trigger)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS amrap_trial_ends_at timestamptz;

-- Trigger: set 7-day trial for new profiles
CREATE OR REPLACE FUNCTION public.set_amrap_trial_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amrap_trial_ends_at IS NULL THEN
    NEW.amrap_trial_ends_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_amrap_trial_on_profile_insert ON public.profiles;
CREATE TRIGGER set_amrap_trial_on_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_amrap_trial_on_profile_insert();

-- amrap_participants: link to auth user
ALTER TABLE amrap_participants
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- amrap_sessions: track creator for HUD
ALTER TABLE amrap_sessions
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

-- Re-grant SELECT on amrap_sessions to include new column (anon/authenticated need it for HUD)
REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at, scheduled_start_at, created_by_user_id)
  ON amrap_sessions TO anon, authenticated;

-- Update create_session: add optional p_user_id (ignored; use auth.uid() to prevent spoofing)
DROP FUNCTION IF EXISTS create_session(int, text, jsonb, timestamptz);

CREATE OR REPLACE FUNCTION create_session(
  p_duration_minutes int,
  p_host_nickname text DEFAULT 'Host',
  p_workout_list jsonb DEFAULT '[]',
  p_scheduled_start_at timestamptz DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_user_id uuid;
BEGIN
  -- Derive from auth.uid(); never trust client-provided p_user_id (prevents identity spoofing)
  v_user_id := auth.uid();

  v_host_token := gen_random_uuid()::text;
  INSERT INTO amrap_sessions (host_token, duration_minutes, workout_list, state, time_left_sec, scheduled_start_at, created_by_user_id)
  VALUES (v_host_token, p_duration_minutes, p_workout_list, 'waiting', 10, p_scheduled_start_at, v_user_id)
  RETURNING id INTO v_session_id;

  INSERT INTO amrap_participants (session_id, nickname, role, user_id)
  VALUES (
    v_session_id,
    COALESCE(NULLIF(trim(p_host_nickname), ''), 'Host'),
    'host',
    v_user_id
  )
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id
  );
END;
$$;

-- Update join_session: add optional p_user_id (ignored; use auth.uid() to prevent spoofing)
DROP FUNCTION IF EXISTS join_session(uuid, text);

CREATE OR REPLACE FUNCTION join_session(
  p_session_id uuid,
  p_nickname text DEFAULT 'Anonymous',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
  v_session_id uuid;
  v_user_id uuid;
BEGIN
  -- Derive from auth.uid(); never trust client-provided p_user_id (prevents identity spoofing)
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

  INSERT INTO amrap_participants (session_id, nickname, role, user_id)
  VALUES (p_session_id, trim(p_nickname), 'joiner', v_user_id)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;

-- shared.amrap_session_results: user-scoped session summaries for HUD HistoryZone
CREATE TABLE IF NOT EXISTS shared.amrap_session_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES amrap_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES amrap_participants(id) ON DELETE CASCADE,
  total_rounds int NOT NULL DEFAULT 0,
  workout_list jsonb NOT NULL DEFAULT '[]',
  duration_minutes int NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_amrap_session_results_user ON shared.amrap_session_results(user_id);
CREATE INDEX IF NOT EXISTS idx_amrap_session_results_completed ON shared.amrap_session_results(completed_at DESC);

GRANT SELECT, INSERT ON shared.amrap_session_results TO authenticated;
ALTER TABLE shared.amrap_session_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own amrap_session_results" ON shared.amrap_session_results;
DROP POLICY IF EXISTS "Users can insert own amrap_session_results" ON shared.amrap_session_results;

CREATE POLICY "Users can read own amrap_session_results"
  ON shared.amrap_session_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own amrap_session_results"
  ON shared.amrap_session_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to persist session results when session finishes (called from client or trigger)
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
BEGIN
  SELECT id, duration_minutes, workout_list INTO v_session
  FROM amrap_sessions WHERE id = p_session_id AND state = 'finished';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_participant IN
    SELECT p.id, p.user_id FROM amrap_participants p
    WHERE p.session_id = p_session_id AND p.user_id IS NOT NULL
  LOOP
    SELECT COALESCE(count(*), 0) INTO v_rounds
    FROM amrap_rounds WHERE session_id = p_session_id AND participant_id = v_participant.id;

    INSERT INTO shared.amrap_session_results (user_id, session_id, participant_id, total_rounds, workout_list, duration_minutes, completed_at)
    VALUES (v_participant.user_id, p_session_id, v_participant.id, v_rounds, v_session.workout_list, v_session.duration_minutes, now())
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      total_rounds = EXCLUDED.total_rounds,
      completed_at = EXCLUDED.completed_at;
  END LOOP;
END;
$$;

-- Only trigger and service_role need EXECUTE; anon must not call directly (prevents bypass)
REVOKE EXECUTE ON FUNCTION public.persist_amrap_session_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_amrap_session_results(uuid) TO authenticated, service_role;

-- Trigger: persist results when session finishes
CREATE OR REPLACE FUNCTION public.on_amrap_session_finished()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM 'finished' AND NEW.state = 'finished' THEN
    PERFORM persist_amrap_session_results(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_amrap_session_finished ON amrap_sessions;
CREATE TRIGGER on_amrap_session_finished
  AFTER UPDATE OF state ON amrap_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_amrap_session_finished();
