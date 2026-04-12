-- Idempotent client join: signed-in users who already have a client row for this session
-- (e.g. left the room and re-enter) get the same participant_id instead of a duplicate INSERT.
-- Anonymous clients (user_id NULL): unchanged — each join may still add a new row (guests).

CREATE OR REPLACE FUNCTION public.trainer_live_join_session(
  p_session_id uuid,
  p_display_name text DEFAULT 'Guest'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sid uuid;
  v_invited uuid;
  v_count int;
  v_participant_id uuid;
  v_existing_id uuid;
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  v_name := COALESCE(NULLIF(trim(p_display_name), ''), 'Guest');
  IF length(v_name) > 80 THEN
    v_name := left(v_name, 80);
  END IF;

  SELECT id, invited_client_user_id
  INTO v_sid, v_invited
  FROM public.trainer_live_sessions
  WHERE id = p_session_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or ended';
  END IF;

  IF v_invited IS NOT NULL THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'This live session is reserved for a specific participant. Sign in to join.';
    END IF;
    IF v_uid IS DISTINCT FROM v_invited THEN
      RAISE EXCEPTION 'This live session link is for another participant.';
    END IF;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(trim(full_name), ''),
      NULLIF(trim(username), ''),
      v_name
    ) INTO v_name
    FROM public.profiles
    WHERE id = v_uid;

    IF v_name IS NULL THEN
      v_name := COALESCE(NULLIF(trim(p_display_name), ''), 'Guest');
      IF length(v_name) > 80 THEN
        v_name := left(v_name, 80);
      END IF;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.trainer_live_participants
    WHERE session_id = p_session_id
      AND role = 'client'
      AND user_id = v_uid
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.trainer_live_participants
      SET display_name = v_name
      WHERE id = v_existing_id;
      RETURN jsonb_build_object('participant_id', v_existing_id);
    END IF;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.trainer_live_participants
  WHERE session_id = p_session_id AND role = 'client';

  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Session is full (max 6 clients)';
  END IF;

  INSERT INTO public.trainer_live_participants (session_id, role, display_name, user_id)
  VALUES (p_session_id, 'client', v_name, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;
