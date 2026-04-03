-- Trainer Live P1: optional roster-scoped invite + profile display names on join

ALTER TABLE public.trainer_live_sessions
  ADD COLUMN IF NOT EXISTS invited_client_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_live_sessions_invited_client
  ON public.trainer_live_sessions (invited_client_user_id)
  WHERE invited_client_user_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.trainer_live_create_session(text);

CREATE OR REPLACE FUNCTION public.trainer_live_create_session(
  p_shell text DEFAULT 'video_only',
  p_invited_client_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_participant_id uuid;
  v_display text;
  v_shell text := COALESCE(NULLIF(trim(p_shell), ''), 'video_only');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_mission_control_staff() THEN
    RAISE EXCEPTION 'Not authorized to create trainer live sessions';
  END IF;

  IF v_shell IS DISTINCT FROM 'video_only' THEN
    RAISE EXCEPTION 'Invalid shell';
  END IF;

  IF p_invited_client_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_programs up
      INNER JOIN public.programs pr ON pr.id = up.program_id
      WHERE up.user_id = p_invited_client_user_id
        AND pr.trainer_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Client is not on your roster';
    END IF;
  END IF;

  SELECT COALESCE(
    NULLIF(trim(t.display_name), ''),
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.username), ''),
    'Trainer'
  ) INTO v_display
  FROM public.profiles p
  LEFT JOIN public.trainers t ON t.user_id = p.id
  WHERE p.id = v_uid;

  IF v_display IS NULL THEN
    v_display := 'Trainer';
  END IF;

  INSERT INTO public.trainer_live_sessions (trainer_user_id, shell, status, invited_client_user_id)
  VALUES (v_uid, v_shell, 'active', p_invited_client_user_id)
  RETURNING id INTO v_session_id;

  INSERT INTO public.trainer_live_participants (session_id, role, display_name, user_id)
  VALUES (v_session_id, 'trainer', v_display, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'participant_id', v_participant_id
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.trainer_live_session_join_hints(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_requires boolean;
BEGIN
  SELECT (invited_client_user_id IS NOT NULL)
  INTO v_requires
  FROM public.trainer_live_sessions
  WHERE id = p_session_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'active', false,
      'requires_invited_account', false
    );
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'requires_invited_account', COALESCE(v_requires, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_create_session(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_session_join_hints(uuid) TO anon, authenticated;
