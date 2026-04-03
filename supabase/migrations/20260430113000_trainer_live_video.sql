-- Trainer Live Video P0: sessions, participants, RLS, RPCs (Agora channel = session id, account = participant id)
-- Runs after 20260430103000_trainers_table (references public.trainers).

CREATE TABLE IF NOT EXISTS public.trainer_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  shell text NOT NULL DEFAULT 'video_only' CHECK (shell IN ('video_only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.trainer_live_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.trainer_live_sessions (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('trainer', 'client')),
  display_name text NOT NULL,
  user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_live_participants_session
  ON public.trainer_live_participants (session_id);

-- RPC: create session + trainer participant (Mission Control staff only)
CREATE OR REPLACE FUNCTION public.trainer_live_create_session(p_shell text DEFAULT 'video_only')
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

  INSERT INTO public.trainer_live_sessions (trainer_user_id, shell, status)
  VALUES (v_uid, v_shell, 'active')
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

-- RPC: join as client (max 6 clients; session must be active)
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
  v_count int;
  v_participant_id uuid;
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  v_name := COALESCE(NULLIF(trim(p_display_name), ''), 'Guest');
  IF length(v_name) > 80 THEN
    v_name := left(v_name, 80);
  END IF;

  SELECT id INTO v_sid
  FROM public.trainer_live_sessions
  WHERE id = p_session_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or ended';
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

-- RPC: end session (trainer only)
CREATE OR REPLACE FUNCTION public.trainer_live_end_session(p_session_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.trainer_live_sessions
  SET status = 'ended', ended_at = now()
  WHERE id = p_session_id AND trainer_user_id = v_uid AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_create_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_join_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_end_session(uuid) TO authenticated;

-- RLS
ALTER TABLE public.trainer_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_live_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY trainer_live_sessions_select_own
  ON public.trainer_live_sessions FOR SELECT TO authenticated
  USING (trainer_user_id = (SELECT auth.uid()));

CREATE POLICY trainer_live_sessions_select_active
  ON public.trainer_live_sessions FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY trainer_live_participants_select
  ON public.trainer_live_participants FOR SELECT TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.trainer_live_sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.trainer_live_participants FROM anon, authenticated;

GRANT SELECT ON public.trainer_live_sessions TO anon, authenticated;
GRANT SELECT ON public.trainer_live_participants TO anon, authenticated;
