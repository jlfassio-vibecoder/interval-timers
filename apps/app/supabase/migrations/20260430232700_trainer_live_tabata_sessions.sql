-- Trainer Live Tabata (T0): interval_wrapper_kind 'tabata', tabata_sessions + RLS, activity segments,
-- trainer_live_activity_begin_tabata_segment, tabata_session_apply_patch.
-- See docs/TRAINER_LIVE_TABATA_WRAPPER_TDD.md

-- ---------------------------------------------------------------------------
-- 1. Widen interval_wrapper_kind
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainer_live_sessions
  DROP CONSTRAINT IF EXISTS trainer_live_sessions_interval_wrapper_kind_check;

ALTER TABLE public.trainer_live_sessions
  ADD CONSTRAINT trainer_live_sessions_interval_wrapper_kind_check CHECK (
    interval_wrapper_kind IN ('none', 'simple_countdown', 'amrap', 'tabata')
  );

-- ---------------------------------------------------------------------------
-- 2. tabata_sessions
-- workout_list: TBD shape; typically exercise labels/order for UI (Mission Control adapter later).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tabata_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trainer_live_session_id uuid NOT NULL REFERENCES public.trainer_live_sessions (id) ON DELETE CASCADE,
  work_seconds integer NOT NULL DEFAULT 20,
  rest_seconds integer NOT NULL DEFAULT 10,
  round_count integer NOT NULL DEFAULT 8,
  workout_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  state jsonb NOT NULL DEFAULT '{"phase":"idle","version":1}'::jsonb,
  CONSTRAINT tabata_sessions_round_count_check CHECK (round_count >= 1 AND round_count <= 32),
  CONSTRAINT tabata_sessions_work_seconds_check CHECK (work_seconds >= 1 AND work_seconds <= 120),
  CONSTRAINT tabata_sessions_rest_seconds_check CHECK (rest_seconds >= 0 AND rest_seconds <= 120)
);

CREATE INDEX IF NOT EXISTS idx_tabata_sessions_trainer_live_session_id
  ON public.tabata_sessions (trainer_live_session_id);

CREATE INDEX IF NOT EXISTS idx_tabata_sessions_created_at
  ON public.tabata_sessions (created_at);

ALTER TABLE public.tabata_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tabata_sessions FROM anon, authenticated;

CREATE POLICY tabata_sessions_select_trainer
  ON public.tabata_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_sessions s
      WHERE s.id = tabata_sessions.trainer_live_session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY tabata_sessions_select_participant
  ON public.tabata_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_participants p
      WHERE p.session_id = tabata_sessions.trainer_live_session_id
        AND p.user_id IS NOT NULL
        AND p.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.tabata_sessions TO authenticated;

-- Realtime (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tabata_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

ALTER TABLE public.tabata_sessions REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 3. Activity segments: tabata type + FK
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainer_live_activity_segments
  DROP CONSTRAINT IF EXISTS trainer_live_activity_segments_segment_type_check;

ALTER TABLE public.trainer_live_activity_segments
  ADD CONSTRAINT trainer_live_activity_segments_segment_type_check CHECK (
    segment_type IN (
      'warmup',
      'amrap',
      'tabata',
      'cooldown',
      'simple_interval',
      'rest',
      'other'
    )
  );

ALTER TABLE public.trainer_live_activity_segments
  ADD COLUMN IF NOT EXISTS tabata_session_id uuid NULL REFERENCES public.tabata_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_live_activity_segments_tabata
  ON public.trainer_live_activity_segments (tabata_session_id)
  WHERE tabata_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. trainer_live_activity_begin_segment: allow 'tabata' in validator
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_begin_segment(
  p_trainer_live_session_id uuid,
  p_segment_type text,
  p_label text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  v_activity_id uuid;
  v_ord int;
  v_seg_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trainer_user_id INTO v_trainer
  FROM public.trainer_live_sessions WHERE id = p_trainer_live_session_id;
  IF NOT FOUND OR v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_segment_type NOT IN (
    'warmup',
    'amrap',
    'tabata',
    'cooldown',
    'simple_interval',
    'rest',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid segment type';
  END IF;

  SELECT id INTO v_activity_id
  FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id
    AND status IN ('active', 'paused');

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'Start the activity timer first';
  END IF;

  PERFORM public._trainer_live_close_open_segment(v_activity_id);

  SELECT COALESCE(MAX(ordinal), -1) + 1 INTO v_ord
  FROM public.trainer_live_activity_segments
  WHERE activity_session_id = v_activity_id;

  INSERT INTO public.trainer_live_activity_segments (
    activity_session_id, ordinal, segment_type, label, started_at
  )
  VALUES (
    v_activity_id, v_ord, p_segment_type, COALESCE(NULLIF(trim(p_label), ''), p_segment_type), clock_timestamp()
  )
  RETURNING id INTO v_seg_id;

  RETURN jsonb_build_object(
    'segment_id', v_seg_id,
    'ordinal', v_ord,
    'ok', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Activity get_state: include tabata_session_id in segments JSON
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
      'tabata_session_id', s.tabata_session_id
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
      'tabata_session_id', s.tabata_session_id
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

-- ---------------------------------------------------------------------------
-- 6. trainer_live_activity_begin_tabata_segment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_begin_tabata_segment(
  p_trainer_live_session_id uuid,
  p_label text DEFAULT 'Tabata',
  p_round_count int DEFAULT 8,
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
  v_tabata_id uuid;
  v_rc int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

  v_rc := COALESCE(p_round_count, 8);
  IF v_rc < 1 OR v_rc > 32 THEN
    RAISE EXCEPTION 'round_count must be between 1 and 32';
  END IF;

  INSERT INTO public.tabata_sessions (
    created_by,
    trainer_live_session_id,
    work_seconds,
    rest_seconds,
    round_count,
    workout_list,
    state
  )
  VALUES (
    v_uid,
    p_trainer_live_session_id,
    20,
    10,
    v_rc,
    COALESCE(p_workout_list, '[]'::jsonb),
    '{"phase":"idle","version":1}'::jsonb
  )
  RETURNING id INTO v_tabata_id;

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'tabata',
    interval_wrapper_config = jsonb_build_object('tabata_session_id', v_tabata_id)
  WHERE id = p_trainer_live_session_id;

  PERFORM public._trainer_live_close_open_segment(v_activity_id);

  SELECT COALESCE(MAX(ordinal), -1) + 1 INTO v_ord
  FROM public.trainer_live_activity_segments
  WHERE activity_session_id = v_activity_id;

  INSERT INTO public.trainer_live_activity_segments (
    activity_session_id, ordinal, segment_type, label, started_at, tabata_session_id
  )
  VALUES (
    v_activity_id,
    v_ord,
    'tabata',
    COALESCE(NULLIF(trim(p_label), ''), 'Tabata'),
    clock_timestamp(),
    v_tabata_id
  )
  RETURNING id INTO v_seg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'segment_id', v_seg_id,
    'tabata_session_id', v_tabata_id,
    'ordinal', v_ord
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_begin_tabata_segment(uuid, text, int, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. tabata_session_apply_patch (trainer only; merges into state, bumps version)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tabata_session_apply_patch(
  p_tabata_session_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
  v_new jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_patch IS NULL OR p_patch = 'null'::jsonb THEN
    RAISE EXCEPTION 'patch required';
  END IF;

  SELECT trainer_live_session_id INTO v_tl
  FROM public.tabata_sessions
  WHERE id = p_tabata_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tabata session not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trainer_live_sessions s
    WHERE s.id = v_tl AND s.trainer_user_id = v_uid AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.tabata_sessions
  SET state = jsonb_set(
    COALESCE(state, '{}'::jsonb) || p_patch,
    '{version}',
    to_jsonb(COALESCE((state->>'version')::int, 0) + 1),
    true
  )
  WHERE id = p_tabata_session_id
  RETURNING state INTO v_new;

  RETURN jsonb_build_object('ok', true, 'state', v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tabata_session_apply_patch(uuid, jsonb) TO authenticated;
