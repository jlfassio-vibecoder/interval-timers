-- AMRAP With Friends: sessions, participants, rounds, RPCs, RLS, Realtime
-- SETUP_DURATION_SECONDS = 10 (from timer-core)

CREATE TABLE IF NOT EXISTS amrap_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_token text NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes IN (5, 15, 20)),
  workout_list jsonb NOT NULL DEFAULT '[]',
  state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'setup', 'work', 'finished')),
  time_left_sec int NOT NULL DEFAULT 10,
  is_paused boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amrap_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES amrap_sessions(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT 'Anonymous',
  role text NOT NULL CHECK (role IN ('host', 'joiner')),
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amrap_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES amrap_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES amrap_participants(id) ON DELETE CASCADE,
  round_index int NOT NULL,
  elapsed_sec_at_round int NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_amrap_participants_session ON amrap_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_amrap_rounds_session ON amrap_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_amrap_rounds_participant ON amrap_rounds(participant_id);

-- RPC: create_session(duration_minutes, workout_list) -> { session_id, host_token, participant_id }
CREATE OR REPLACE FUNCTION create_session(p_duration_minutes int, p_workout_list jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
BEGIN
  v_host_token := gen_random_uuid()::text;
  INSERT INTO amrap_sessions (host_token, duration_minutes, workout_list, state, time_left_sec)
  VALUES (v_host_token, p_duration_minutes, p_workout_list, 'waiting', 10)
  RETURNING id INTO v_session_id;

  INSERT INTO amrap_participants (session_id, nickname, role)
  VALUES (v_session_id, 'Host', 'host')
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id
  );
END;
$$;

-- RPC: join_session(p_session_id, p_nickname) -> { participant_id } or error
CREATE OR REPLACE FUNCTION join_session(p_session_id uuid, p_nickname text DEFAULT 'Anonymous')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
BEGIN
  SELECT count(*) INTO v_count FROM amrap_participants WHERE session_id = p_session_id;
  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Session is full (max 6 participants)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM amrap_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  INSERT INTO amrap_participants (session_id, nickname, role)
  VALUES (p_session_id, COALESCE(NULLIF(trim(p_nickname), ''), 'Anonymous'), 'joiner')
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;

-- RPC: update_session_state (host only; validates host_token)
CREATE OR REPLACE FUNCTION update_session_state(
  p_session_id uuid,
  p_host_token text,
  p_state text,
  p_time_left_sec int,
  p_is_paused boolean,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE amrap_sessions
  SET
    state = p_state,
    time_left_sec = p_time_left_sec,
    is_paused = p_is_paused,
    started_at = COALESCE(p_started_at, started_at)
  WHERE id = p_session_id AND host_token = p_host_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- RLS
ALTER TABLE amrap_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE amrap_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE amrap_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amrap_sessions_select" ON amrap_sessions FOR SELECT USING (true);
CREATE POLICY "amrap_sessions_insert" ON amrap_sessions FOR INSERT WITH CHECK (true);
-- UPDATE only via update_session_state RPC; no direct UPDATE policy

CREATE POLICY "amrap_participants_select" ON amrap_participants FOR SELECT USING (true);
CREATE POLICY "amrap_participants_insert" ON amrap_participants FOR INSERT WITH CHECK (true);

CREATE POLICY "amrap_rounds_select" ON amrap_rounds FOR SELECT USING (true);
CREATE POLICY "amrap_rounds_insert" ON amrap_rounds FOR INSERT WITH CHECK (true);

-- Realtime: full row on update/delete for amrap_sessions
ALTER TABLE amrap_sessions REPLICA IDENTITY FULL;

-- Add amrap_sessions to realtime publication (run in Supabase SQL Editor if this fails)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE amrap_sessions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
