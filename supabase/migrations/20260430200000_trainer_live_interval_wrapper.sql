-- Trainer Live: interval wrapper columns (Option A), attach AMRAP RPC, join_hints extension,
-- RLS so participants can read active session row (wrapper updates / Realtime).

ALTER TABLE public.trainer_live_sessions
  ADD COLUMN IF NOT EXISTS interval_wrapper_kind text NOT NULL DEFAULT 'none'
    CONSTRAINT trainer_live_sessions_interval_wrapper_kind_check CHECK (
      interval_wrapper_kind IN ('none', 'simple_countdown', 'amrap')
    );

ALTER TABLE public.trainer_live_sessions
  ADD COLUMN IF NOT EXISTS interval_wrapper_config jsonb NULL;

-- Participants (authenticated, user_id set) can read the parent session row for active rooms
-- they belong to — needed for interval wrapper state + Supabase Realtime.
DROP POLICY IF EXISTS trainer_live_sessions_select_participant ON public.trainer_live_sessions;

CREATE POLICY trainer_live_sessions_select_participant
  ON public.trainer_live_sessions FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.trainer_live_participants p
      WHERE p.session_id = trainer_live_sessions.id
        AND p.user_id IS NOT NULL
        AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.trainer_live_attach_amrap_session(p_trainer_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shell text;
  v_kind text;
  v_cfg jsonb;
  v_amrap_id uuid;
  v_existing uuid;
  v_host_token text;
  v_display text;
  v_created jsonb;
  v_tl_trainer uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT shell, interval_wrapper_kind, interval_wrapper_config, trainer_user_id
  INTO v_shell, v_kind, v_cfg, v_tl_trainer
  FROM public.trainer_live_sessions
  WHERE id = p_trainer_live_session_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or ended';
  END IF;

  IF v_tl_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_shell IS DISTINCT FROM 'countdown_timer' THEN
    RAISE EXCEPTION 'Interval tools require countdown_timer layout';
  END IF;

  -- Idempotent: already amrap with a valid linked session
  IF v_kind = 'amrap' AND v_cfg IS NOT NULL AND v_cfg ? 'amrap_session_id' THEN
    v_existing := NULL;
    BEGIN
      v_existing := (v_cfg->>'amrap_session_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_existing := NULL;
    END;
    IF v_existing IS NOT NULL THEN
      SELECT s.host_token INTO v_host_token
      FROM public.amrap_sessions s
      WHERE s.id = v_existing;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'amrap_session_id', v_existing,
          'host_token', v_host_token,
          'already_attached', true
        );
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(
    NULLIF(trim(t.display_name), ''),
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.username), ''),
    'Host'
  ) INTO v_display
  FROM public.profiles p
  LEFT JOIN public.trainers t ON t.user_id = p.id
  WHERE p.id = v_uid;

  IF v_display IS NULL THEN
    v_display := 'Host';
  END IF;

  v_created := public.create_session(15, v_display, '[]'::jsonb, NULL, NULL);
  v_amrap_id := (v_created->>'session_id')::uuid;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'amrap',
    interval_wrapper_config = jsonb_build_object('amrap_session_id', v_amrap_id)
  WHERE id = p_trainer_live_session_id;

  RETURN jsonb_build_object(
    'amrap_session_id', v_amrap_id,
    'host_token', v_created->>'host_token',
    'amrap_participant_id', v_created->>'participant_id',
    'already_attached', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_attach_amrap_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trainer_live_session_join_hints(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_requires boolean;
  v_shell text;
  v_kind text;
  v_cfg jsonb;
BEGIN
  SELECT
    (invited_client_user_id IS NOT NULL),
    shell,
    COALESCE(interval_wrapper_kind, 'none'),
    interval_wrapper_config
  INTO v_requires, v_shell, v_kind, v_cfg
  FROM public.trainer_live_sessions
  WHERE id = p_session_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'active', false,
      'requires_invited_account', false,
      'shell', 'video_only',
      'interval_wrapper_kind', 'none',
      'interval_wrapper_config', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'requires_invited_account', COALESCE(v_requires, false),
    'shell', COALESCE(v_shell, 'video_only'),
    'interval_wrapper_kind', COALESCE(v_kind, 'none'),
    'interval_wrapper_config', v_cfg
  );
END;
$$;
