-- Trainer Live P2: second shell countdown_timer + join_hints.shell

ALTER TABLE public.trainer_live_sessions
  DROP CONSTRAINT IF EXISTS trainer_live_sessions_shell_check;

ALTER TABLE public.trainer_live_sessions
  ADD CONSTRAINT trainer_live_sessions_shell_check CHECK (
    shell IN ('video_only', 'countdown_timer')
  );

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

  IF v_shell NOT IN ('video_only', 'countdown_timer') THEN
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

CREATE OR REPLACE FUNCTION public.trainer_live_session_join_hints(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_requires boolean;
  v_shell text;
BEGIN
  SELECT
    (invited_client_user_id IS NOT NULL),
    shell
  INTO v_requires, v_shell
  FROM public.trainer_live_sessions
  WHERE id = p_session_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'active', false,
      'requires_invited_account', false,
      'shell', 'video_only'
    );
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'requires_invited_account', COALESCE(v_requires, false),
    'shell', COALESCE(v_shell, 'video_only')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_create_session(text, uuid) TO authenticated;
