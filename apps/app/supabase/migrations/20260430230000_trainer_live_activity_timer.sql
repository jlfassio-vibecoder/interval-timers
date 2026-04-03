-- Trainer Live: activity timer + segment timeline + workout_logs sync (parent session row).
-- One activity_session row per trainer_live_session (cannot restart after finalize).

CREATE TABLE IF NOT EXISTS public.trainer_live_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_live_session_id uuid NOT NULL REFERENCES public.trainer_live_sessions (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finalized')),
  accumulated_elapsed_sec integer NOT NULL DEFAULT 0,
  last_resume_at timestamptz NULL,
  planned_duration_sec integer NULL,
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_live_activity_sessions_one_per_live UNIQUE (trainer_live_session_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_live_activity_sessions_live
  ON public.trainer_live_activity_sessions (trainer_live_session_id);

CREATE TABLE IF NOT EXISTS public.trainer_live_activity_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_session_id uuid NOT NULL REFERENCES public.trainer_live_activity_sessions (id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  segment_type text NOT NULL CHECK (
    segment_type IN ('warmup', 'amrap', 'cooldown', 'simple_interval', 'rest', 'other')
  ),
  label text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  amrap_session_id uuid NULL REFERENCES public.amrap_sessions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trainer_live_activity_segments_activity
  ON public.trainer_live_activity_segments (activity_session_id, ordinal);

CREATE INDEX IF NOT EXISTS idx_trainer_live_activity_segments_amrap
  ON public.trainer_live_activity_segments (amrap_session_id)
  WHERE amrap_session_id IS NOT NULL;

ALTER TABLE public.trainer_live_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_live_activity_segments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.trainer_live_activity_sessions FROM anon, authenticated;
REVOKE ALL ON public.trainer_live_activity_segments FROM anon, authenticated;

-- Trainer: full access to activity rows for their live sessions
CREATE POLICY trainer_live_activity_sessions_select_trainer
  ON public.trainer_live_activity_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_sessions s
      WHERE s.id = trainer_live_activity_sessions.trainer_live_session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY trainer_live_activity_segments_select_trainer
  ON public.trainer_live_activity_segments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_live_activity_sessions a
      INNER JOIN public.trainer_live_sessions s ON s.id = a.trainer_live_session_id
      WHERE a.id = trainer_live_activity_segments.activity_session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

-- Signed-in participants: read activity for sessions they belong to
CREATE POLICY trainer_live_activity_sessions_select_participant
  ON public.trainer_live_activity_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_participants p
      WHERE p.session_id = trainer_live_activity_sessions.trainer_live_session_id
        AND p.user_id IS NOT NULL
        AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY trainer_live_activity_segments_select_participant
  ON public.trainer_live_activity_segments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_live_activity_sessions a
      INNER JOIN public.trainer_live_participants p ON p.session_id = a.trainer_live_session_id
      WHERE a.id = trainer_live_activity_segments.activity_session_id
        AND p.user_id IS NOT NULL
        AND p.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.trainer_live_activity_sessions TO authenticated;
GRANT SELECT ON public.trainer_live_activity_segments TO authenticated;

-- Realtime (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_live_activity_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_live_activity_segments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

ALTER TABLE public.trainer_live_activity_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.trainer_live_activity_segments REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- Internal: current elapsed seconds (active clock only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._trainer_live_activity_current_elapsed(p_activity_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r RECORD;
  add_sec int;
BEGIN
  SELECT accumulated_elapsed_sec, last_resume_at, status
  INTO r
  FROM public.trainer_live_activity_sessions
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF r.status = 'paused' OR r.status = 'finalized' OR r.last_resume_at IS NULL THEN
    RETURN GREATEST(0, r.accumulated_elapsed_sec);
  END IF;

  add_sec := GREATEST(0, (extract(epoch FROM (clock_timestamp() - r.last_resume_at)))::integer);
  RETURN GREATEST(0, r.accumulated_elapsed_sec + add_sec);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: start activity timer (trainer only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_start(
  p_trainer_live_session_id uuid,
  p_planned_duration_sec integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  v_live_status text;
  v_id uuid;
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trainer_user_id, status INTO v_trainer, v_live_status
  FROM public.trainer_live_sessions
  WHERE id = p_trainer_live_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_live_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Live session is not active';
  END IF;

  SELECT * INTO v_row
  FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id;

  IF FOUND THEN
    IF v_row.status = 'finalized' THEN
      RAISE EXCEPTION 'Activity session already finalized';
    END IF;
    IF v_row.status IN ('active', 'paused') THEN
      RAISE EXCEPTION 'Activity timer already running';
    END IF;
  END IF;

  INSERT INTO public.trainer_live_activity_sessions (
    trainer_live_session_id,
    status,
    accumulated_elapsed_sec,
    last_resume_at,
    planned_duration_sec,
    started_at
  )
  VALUES (
    p_trainer_live_session_id,
    'active',
    0,
    clock_timestamp(),
    p_planned_duration_sec,
    clock_timestamp()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('activity_session_id', v_id, 'ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_start(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Pause / resume
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_pause(p_trainer_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  v_id uuid;
  r RECORD;
  add_sec int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trainer_user_id INTO v_trainer
  FROM public.trainer_live_sessions WHERE id = p_trainer_live_session_id;
  IF NOT FOUND OR v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO r FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No activity session';
  END IF;
  IF r.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Not running';
  END IF;
  IF r.last_resume_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  add_sec := GREATEST(0, (extract(epoch FROM (clock_timestamp() - r.last_resume_at)))::integer);

  UPDATE public.trainer_live_activity_sessions
  SET
    accumulated_elapsed_sec = r.accumulated_elapsed_sec + add_sec,
    last_resume_at = NULL,
    status = 'paused'
  WHERE id = r.id
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'activity_session_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_pause(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trainer_live_activity_resume(p_trainer_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trainer_user_id INTO v_trainer
  FROM public.trainer_live_sessions WHERE id = p_trainer_live_session_id;
  IF NOT FOUND OR v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.trainer_live_activity_sessions
  SET
    last_resume_at = clock_timestamp(),
    status = 'active'
  WHERE trainer_live_session_id = p_trainer_live_session_id
    AND status = 'paused'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Not paused or no activity session';
  END IF;

  RETURN jsonb_build_object('ok', true, 'activity_session_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_resume(uuid) TO authenticated;

-- Close open segment helper
CREATE OR REPLACE FUNCTION public._trainer_live_close_open_segment(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.trainer_live_activity_segments
  SET ended_at = clock_timestamp()
  WHERE activity_session_id = p_activity_id
    AND ended_at IS NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Begin generic segment
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

  IF p_segment_type NOT IN ('warmup', 'amrap', 'cooldown', 'simple_interval', 'rest', 'other') THEN
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

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_begin_segment(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Begin AMRAP segment: create amrap session + link wrapper (Option A) + segment row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_begin_amrap_segment(
  p_trainer_live_session_id uuid,
  p_label text DEFAULT 'AMRAP'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  v_shell text;
  v_tl_trainer uuid;
  v_activity_id uuid;
  v_ord int;
  v_seg_id uuid;
  v_created jsonb;
  v_amrap_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_display text;
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

  SELECT COALESCE(
    NULLIF(trim(t.display_name), ''),
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.username), ''),
    'Host'
  ) INTO v_display
  FROM public.profiles p
  LEFT JOIN public.trainers t ON t.user_id = p.id
  WHERE p.id = v_uid;

  v_created := public.create_session(15, COALESCE(NULLIF(trim(v_display), ''), 'Host'), '[]'::jsonb, NULL, NULL);
  v_amrap_id := (v_created->>'session_id')::uuid;
  v_host_token := v_created->>'host_token';
  v_participant_id := v_created->>'participant_id';

  UPDATE public.trainer_live_sessions
  SET
    interval_wrapper_kind = 'amrap',
    interval_wrapper_config = jsonb_build_object('amrap_session_id', v_amrap_id)
  WHERE id = p_trainer_live_session_id;

  PERFORM public._trainer_live_close_open_segment(v_activity_id);

  SELECT COALESCE(MAX(ordinal), -1) + 1 INTO v_ord
  FROM public.trainer_live_activity_segments
  WHERE activity_session_id = v_activity_id;

  INSERT INTO public.trainer_live_activity_segments (
    activity_session_id, ordinal, segment_type, label, started_at, amrap_session_id
  )
  VALUES (
    v_activity_id, v_ord, 'amrap', COALESCE(NULLIF(trim(p_label), ''), 'AMRAP'), clock_timestamp(), v_amrap_id
  )
  RETURNING id INTO v_seg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'segment_id', v_seg_id,
    'amrap_session_id', v_amrap_id,
    'host_token', v_host_token,
    'amrap_participant_id', v_participant_id,
    'ordinal', v_ord
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_begin_amrap_segment(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Finalize + persist workout_logs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_live_activity_finalize(p_trainer_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trainer uuid;
  r RECORD;
  add_sec int;
  v_total int;
  v_part RECORD;
  v_dedupe text;
  v_date date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trainer_user_id INTO v_trainer
  FROM public.trainer_live_sessions WHERE id = p_trainer_live_session_id;
  IF NOT FOUND OR v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO r FROM public.trainer_live_activity_sessions
  WHERE trainer_live_session_id = p_trainer_live_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No activity session';
  END IF;

  IF r.status = 'finalized' THEN
    RETURN jsonb_build_object('ok', true, 'already_finalized', true, 'activity_session_id', r.id);
  END IF;

  IF r.status = 'active' AND r.last_resume_at IS NOT NULL THEN
    add_sec := GREATEST(0, (extract(epoch FROM (clock_timestamp() - r.last_resume_at)))::integer);
    r.accumulated_elapsed_sec := r.accumulated_elapsed_sec + add_sec;
  END IF;

  v_total := GREATEST(0, r.accumulated_elapsed_sec);

  PERFORM public._trainer_live_close_open_segment(r.id);

  UPDATE public.trainer_live_activity_sessions
  SET
    status = 'finalized',
    accumulated_elapsed_sec = v_total,
    last_resume_at = NULL,
    ended_at = clock_timestamp()
  WHERE id = r.id;

  v_date := (clock_timestamp() AT TIME ZONE 'UTC')::date;

  FOR v_part IN
    SELECT p.id, p.user_id, p.display_name
    FROM public.trainer_live_participants p
    WHERE p.session_id = p_trainer_live_session_id
      AND p.user_id IS NOT NULL
  LOOP
    v_dedupe := 'trainer_live:' || v_part.user_id::text || ':' || r.id::text;
    INSERT INTO public.workout_logs (
      user_id,
      workout_id,
      workout_name,
      date,
      effort,
      rating,
      notes,
      duration_seconds,
      source,
      handoff_dedupe_key,
      is_active_rest
    )
    VALUES (
      v_part.user_id,
      NULL,
      'Trainer Live session',
      v_date,
      5,
      3,
      '',
      v_total,
      'trainer_live',
      v_dedupe,
      false
    )
    ON CONFLICT (handoff_dedupe_key) WHERE (handoff_dedupe_key IS NOT NULL)
    DO UPDATE SET
      duration_seconds = EXCLUDED.duration_seconds,
      date = EXCLUDED.date,
      workout_name = EXCLUDED.workout_name;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'activity_session_id', r.id,
    'total_elapsed_sec', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_finalize(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- AMRAP child rows: mark is_active_rest when linked to a trainer_live segment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workout_logs_flag_trainer_live_amrap_detail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sid uuid;
  m text[];
BEGIN
  IF NEW.handoff_dedupe_key IS NULL OR NEW.source IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.source IS DISTINCT FROM 'amrap_with_friends' THEN
    RETURN NEW;
  END IF;
  m := regexp_match(NEW.handoff_dedupe_key, '^amrap_with_friends:[^:]+:([0-9a-f-]{36}):');
  IF m IS NULL THEN
    RETURN NEW;
  END IF;
  v_sid := m[1]::uuid;
  IF EXISTS (
    SELECT 1 FROM public.trainer_live_activity_segments s
    WHERE s.amrap_session_id = v_sid
  ) THEN
    NEW.is_active_rest := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_logs_trainer_live_amrap_detail ON public.workout_logs;
CREATE TRIGGER workout_logs_trainer_live_amrap_detail
  BEFORE INSERT ON public.workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.workout_logs_flag_trainer_live_amrap_detail();

-- ---------------------------------------------------------------------------
-- Fetch state (participants + trainer)
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
      'amrap_session_id', s.amrap_session_id
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

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_get_state(uuid) TO authenticated;

-- Join-link / guest: same payload as get_state when participant token is valid
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
      'amrap_session_id', s.amrap_session_id
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

GRANT EXECUTE ON FUNCTION public.trainer_live_activity_get_state_for_participant(uuid, uuid) TO anon, authenticated;
