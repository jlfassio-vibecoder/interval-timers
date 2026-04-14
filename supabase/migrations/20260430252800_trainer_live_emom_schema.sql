-- Trainer Live EMOM Phase 1: emom_sessions, emom_round_logs, interval_wrapper_kind 'emom',
-- activity segment type 'emom', trainer_live_activity_begin_emom_segment, trainer_live_emom_log_round.
-- Join-link guests: trainer_live_emom_log_round_for_participant (anon) uses trainer_live_verify_token_targets.

-- ---------------------------------------------------------------------------
-- 1. emom_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emom_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trainer_live_session_id uuid NOT NULL REFERENCES public.trainer_live_sessions (id) ON DELETE CASCADE,
  round_count integer NOT NULL,
  warmup_seconds integer NOT NULL DEFAULT 10,
  workout_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emom_sessions_round_count_check CHECK (round_count >= 1 AND round_count <= 120),
  CONSTRAINT emom_sessions_warmup_seconds_check CHECK (warmup_seconds >= 0 AND warmup_seconds <= 600)
);

CREATE INDEX IF NOT EXISTS idx_emom_sessions_trainer_live_session_id
  ON public.emom_sessions (trainer_live_session_id);

CREATE INDEX IF NOT EXISTS idx_emom_sessions_created_at
  ON public.emom_sessions (created_at);

ALTER TABLE public.emom_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.emom_sessions FROM anon, authenticated;

CREATE POLICY emom_sessions_select_trainer
  ON public.emom_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_sessions s
      WHERE s.id = emom_sessions.trainer_live_session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY emom_sessions_select_participant
  ON public.emom_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_participants p
      WHERE p.session_id = emom_sessions.trainer_live_session_id
        AND p.user_id IS NOT NULL
        AND p.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.emom_sessions TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.emom_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

ALTER TABLE public.emom_sessions REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 2. emom_round_logs (per-minute splits; UPSERT on unique triple)
-- round_index is 1-based ("Minute 1 of N").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emom_round_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emom_session_id uuid NOT NULL REFERENCES public.emom_sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trainer_live_participants (id) ON DELETE CASCADE,
  round_index integer NOT NULL,
  work_seconds integer NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  logged_weight text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emom_round_logs_round_index_check CHECK (round_index >= 1),
  CONSTRAINT emom_round_logs_work_seconds_check CHECK (work_seconds >= 0 AND work_seconds <= 60),
  CONSTRAINT emom_round_logs_session_participant_round_unique UNIQUE (emom_session_id, participant_id, round_index)
);

CREATE INDEX IF NOT EXISTS idx_emom_round_logs_emom_session_id
  ON public.emom_round_logs (emom_session_id);

CREATE INDEX IF NOT EXISTS idx_emom_round_logs_participant_id
  ON public.emom_round_logs (participant_id);

ALTER TABLE public.emom_round_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.emom_round_logs FROM anon, authenticated;

CREATE POLICY emom_round_logs_select_trainer
  ON public.emom_round_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.emom_sessions es
      INNER JOIN public.trainer_live_sessions s ON s.id = es.trainer_live_session_id
      WHERE es.id = emom_round_logs.emom_session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY emom_round_logs_select_participant_own
  ON public.emom_round_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_participants p
      WHERE p.id = emom_round_logs.participant_id
        AND p.user_id IS NOT NULL
        AND p.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.emom_round_logs TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.emom_round_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

ALTER TABLE public.emom_round_logs REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 3. Widen interval_wrapper_kind + activity segments
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainer_live_sessions
  DROP CONSTRAINT IF EXISTS trainer_live_sessions_interval_wrapper_kind_check;

ALTER TABLE public.trainer_live_sessions
  ADD CONSTRAINT trainer_live_sessions_interval_wrapper_kind_check CHECK (
    interval_wrapper_kind IN ('none', 'simple_countdown', 'amrap', 'tabata', 'emom')
  );

ALTER TABLE public.trainer_live_activity_segments
  DROP CONSTRAINT IF EXISTS trainer_live_activity_segments_segment_type_check;

ALTER TABLE public.trainer_live_activity_segments
  ADD CONSTRAINT trainer_live_activity_segments_segment_type_check CHECK (
    segment_type IN (
      'warmup',
      'amrap',
      'tabata',
      'emom',
      'cooldown',
      'simple_interval',
      'rest',
      'other'
    )
  );

ALTER TABLE public.trainer_live_activity_segments
  ADD COLUMN IF NOT EXISTS emom_session_id uuid NULL REFERENCES public.emom_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_live_activity_segments_emom
  ON public.trainer_live_activity_segments (emom_session_id)
  WHERE emom_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. trainer_live_activity_begin_emom_segment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_begin_emom_segment(
  p_trainer_live_session_id uuid,
  p_label text DEFAULT 'EMOM',
  p_round_count int DEFAULT 10,
  p_workout_list jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shell text;
  v_tl_trainer uuid;
  v_activity_id uuid;
  v_ord int;
  v_seg_id uuid;
  v_emom_id uuid;
  v_rc int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_workout_list IS NULL OR jsonb_typeof(p_workout_list) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_workout_list must be a JSON array';
  END IF;

  SELECT shell, trainer_user_id
  INTO v_shell, v_tl_trainer
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
    RAISE EXCEPTION 'Interval tools require Video + Intervals layout';
  END IF;

  SELECT id INTO v_activity_id
  FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id
    AND status IN ('active', 'paused');

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'Start the activity timer first';
  END IF;

  v_rc := COALESCE(p_round_count, 10);
  IF v_rc < 1 OR v_rc > 120 THEN
    RAISE EXCEPTION 'round_count must be between 1 and 120';
  END IF;

  INSERT INTO public.emom_sessions (
    created_by,
    trainer_live_session_id,
    round_count,
    warmup_seconds,
    workout_list,
    status,
    started_at
  )
  VALUES (
    v_uid,
    p_trainer_live_session_id,
    v_rc,
    10,
    COALESCE(p_workout_list, '[]'::jsonb),
    'active',
    clock_timestamp()
  )
  RETURNING id INTO v_emom_id;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'emom',
    interval_wrapper_config = jsonb_build_object('emom_session_id', v_emom_id)
  WHERE id = p_trainer_live_session_id;

  PERFORM public._trainer_live_close_open_segment(v_activity_id);

  SELECT COALESCE(MAX(ordinal), -1) + 1 INTO v_ord
  FROM public.trainer_live_activity_segments
  WHERE activity_session_id = v_activity_id;

  INSERT INTO public.trainer_live_activity_segments (
    activity_session_id, ordinal, segment_type, label, started_at, emom_session_id
  )
  VALUES (
    v_activity_id,
    v_ord,
    'emom',
    COALESCE(NULLIF(trim(p_label), ''), 'EMOM'),
    clock_timestamp(),
    v_emom_id
  )
  RETURNING id INTO v_seg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'segment_id', v_seg_id,
    'emom_session_id', v_emom_id,
    'ordinal', v_ord
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_begin_emom_segment(uuid, text, int, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Shared UPSERT body: trainer_live_emom_log_round (authenticated participant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_emom_log_round(
  p_emom_session_id uuid,
  p_participant_id uuid,
  p_round_index int,
  p_work_seconds int,
  p_completed boolean,
  p_logged_weight text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl_sid uuid;
  v_round_count int;
  v_st text;
  v_sess uuid;
  v_p_user uuid;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_round_index IS NULL OR p_round_index < 1 THEN
    RAISE EXCEPTION 'Invalid round_index';
  END IF;

  IF p_work_seconds IS NULL OR p_work_seconds < 0 OR p_work_seconds > 60 THEN
    RAISE EXCEPTION 'work_seconds must be between 0 and 60';
  END IF;

  SELECT es.trainer_live_session_id, es.round_count, es.status
  INTO v_tl_sid, v_round_count, v_st
  FROM public.emom_sessions es
  WHERE es.id = p_emom_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMOM session not found';
  END IF;

  IF v_st IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EMOM session is not active';
  END IF;

  IF p_round_index > v_round_count THEN
    RAISE EXCEPTION 'round_index exceeds round_count for this session';
  END IF;

  SELECT p.session_id, p.user_id
  INTO v_sess, v_p_user
  FROM public.trainer_live_participants p
  WHERE p.id = p_participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_sess IS DISTINCT FROM v_tl_sid THEN
    RAISE EXCEPTION 'Participant is not in this EMOM session';
  END IF;

  IF v_p_user IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.emom_round_logs (
    emom_session_id,
    participant_id,
    round_index,
    work_seconds,
    completed,
    logged_weight
  )
  VALUES (
    p_emom_session_id,
    p_participant_id,
    p_round_index,
    p_work_seconds,
    COALESCE(p_completed, false),
    p_logged_weight
  )
  ON CONFLICT ON CONSTRAINT emom_round_logs_session_participant_round_unique
  DO UPDATE SET
    work_seconds = EXCLUDED.work_seconds,
    completed = EXCLUDED.completed,
    logged_weight = COALESCE(EXCLUDED.logged_weight, emom_round_logs.logged_weight),
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row_id,
    'emom_session_id', p_emom_session_id,
    'participant_id', p_participant_id,
    'round_index', p_round_index
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_emom_log_round(uuid, uuid, int, int, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Join-link / guest: same UPSERT after token verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_emom_log_round_for_participant(
  p_trainer_live_session_id uuid,
  p_participant_id uuid,
  p_emom_session_id uuid,
  p_round_index int,
  p_work_seconds int,
  p_completed boolean,
  p_logged_weight text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tl_sid uuid;
  v_round_count int;
  v_st text;
  v_sess uuid;
  v_row_id uuid;
BEGIN
  IF NOT public.trainer_live_verify_token_targets(p_trainer_live_session_id, p_participant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_round_index IS NULL OR p_round_index < 1 THEN
    RAISE EXCEPTION 'Invalid round_index';
  END IF;

  IF p_work_seconds IS NULL OR p_work_seconds < 0 OR p_work_seconds > 60 THEN
    RAISE EXCEPTION 'work_seconds must be between 0 and 60';
  END IF;

  SELECT es.trainer_live_session_id, es.round_count, es.status
  INTO v_tl_sid, v_round_count, v_st
  FROM public.emom_sessions es
  WHERE es.id = p_emom_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMOM session not found';
  END IF;

  IF v_tl_sid IS DISTINCT FROM p_trainer_live_session_id THEN
    RAISE EXCEPTION 'EMOM session does not belong to this live session';
  END IF;

  IF v_st IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EMOM session is not active';
  END IF;

  IF p_round_index > v_round_count THEN
    RAISE EXCEPTION 'round_index exceeds round_count for this session';
  END IF;

  SELECT p.session_id
  INTO v_sess
  FROM public.trainer_live_participants p
  WHERE p.id = p_participant_id;

  IF NOT FOUND OR v_sess IS DISTINCT FROM v_tl_sid THEN
    RAISE EXCEPTION 'Participant is not in this EMOM session';
  END IF;

  INSERT INTO public.emom_round_logs (
    emom_session_id,
    participant_id,
    round_index,
    work_seconds,
    completed,
    logged_weight
  )
  VALUES (
    p_emom_session_id,
    p_participant_id,
    p_round_index,
    p_work_seconds,
    COALESCE(p_completed, false),
    p_logged_weight
  )
  ON CONFLICT ON CONSTRAINT emom_round_logs_session_participant_round_unique
  DO UPDATE SET
    work_seconds = EXCLUDED.work_seconds,
    completed = EXCLUDED.completed,
    logged_weight = COALESCE(EXCLUDED.logged_weight, emom_round_logs.logged_weight),
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row_id,
    'emom_session_id', p_emom_session_id,
    'participant_id', p_participant_id,
    'round_index', p_round_index
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_emom_log_round_for_participant(uuid, uuid, uuid, int, int, boolean, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Activity get_state: include emom_session_id in segments JSON (parallel Tabata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_get_state(p_trainer_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean;
  a RECORD;
  v_elapsed int;
  segs jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_allowed := EXISTS (
    SELECT 1 FROM public.trainer_live_sessions s
    WHERE s.id = p_trainer_live_session_id AND s.trainer_user_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.trainer_live_participants p
    WHERE p.session_id = p_trainer_live_session_id
      AND p.user_id = v_uid
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO a FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_activity', false);
  END IF;

  v_elapsed := public._trainer_live_activity_current_elapsed(a.id);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'ordinal', s.ordinal,
      'segment_type', s.segment_type,
      'label', s.label,
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'amrap_session_id', s.amrap_session_id,
      'tabata_session_id', s.tabata_session_id,
      'emom_session_id', s.emom_session_id
    ) ORDER BY s.ordinal
  ), '[]'::jsonb)
  INTO segs
  FROM public.trainer_live_activity_segments s
  WHERE s.activity_session_id = a.id;

  RETURN jsonb_build_object(
    'has_activity', true,
    'activity_session_id', a.id,
    'status', a.status,
    'accumulated_elapsed_sec', a.accumulated_elapsed_sec,
    'current_elapsed_sec', v_elapsed,
    'last_resume_at', a.last_resume_at,
    'planned_duration_sec', a.planned_duration_sec,
    'started_at', a.started_at,
    'ended_at', a.ended_at,
    'segments', segs
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_activity_get_state_for_participant(
  p_trainer_live_session_id uuid,
  p_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  a RECORD;
  v_elapsed int;
  segs jsonb;
BEGIN
  IF NOT public.trainer_live_verify_token_targets(p_trainer_live_session_id, p_participant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO a FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_activity', false);
  END IF;

  v_elapsed := public._trainer_live_activity_current_elapsed(a.id);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'ordinal', s.ordinal,
      'segment_type', s.segment_type,
      'label', s.label,
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'amrap_session_id', s.amrap_session_id,
      'tabata_session_id', s.tabata_session_id,
      'emom_session_id', s.emom_session_id
    ) ORDER BY s.ordinal
  ), '[]'::jsonb)
  INTO segs
  FROM public.trainer_live_activity_segments s
  WHERE s.activity_session_id = a.id;

  RETURN jsonb_build_object(
    'has_activity', true,
    'activity_session_id', a.id,
    'status', a.status,
    'accumulated_elapsed_sec', a.accumulated_elapsed_sec,
    'current_elapsed_sec', v_elapsed,
    'last_resume_at', a.last_resume_at,
    'planned_duration_sec', a.planned_duration_sec,
    'started_at', a.started_at,
    'ended_at', a.ended_at,
    'segments', segs
  );
END;
$$;
