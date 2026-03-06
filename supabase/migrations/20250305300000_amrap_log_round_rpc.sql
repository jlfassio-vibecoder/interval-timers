-- Atomic round logging: assign round_index in DB to avoid duplicate/out-of-order rounds on double-click or Realtime lag.

-- Prevent duplicate (session, participant, round_index) at the DB level.
ALTER TABLE amrap_rounds
  ADD CONSTRAINT amrap_rounds_session_participant_round_unique
  UNIQUE (session_id, participant_id, round_index);

-- RPC: assign next round_index for the participant and insert. Serializes per session via lock.
CREATE OR REPLACE FUNCTION log_round(
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
  v_next_index int;
  v_new_id uuid;
BEGIN
  -- Lock session row to serialize round logging for this session and ensure session exists.
  PERFORM id FROM amrap_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT COALESCE(MAX(round_index), 0) + 1 INTO v_next_index
  FROM amrap_rounds
  WHERE session_id = p_session_id AND participant_id = p_participant_id;

  INSERT INTO amrap_rounds (session_id, participant_id, round_index, elapsed_sec_at_round)
  VALUES (p_session_id, p_participant_id, v_next_index, p_elapsed_sec_at_round)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('round_index', v_next_index, 'id', v_new_id);
END;
$$;
