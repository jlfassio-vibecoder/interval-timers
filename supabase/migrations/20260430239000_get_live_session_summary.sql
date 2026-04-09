-- Read-only aggregate for post-workout Trainer Live summary (one JSON payload; SECURITY INVOKER + RLS).
-- AMRAP per-round splits: elapsed_sec_at_round is cumulative — split_i = elapsed_i - lag(elapsed_i).

CREATE OR REPLACE FUNCTION public.get_live_session_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_activity_id uuid;
  v_activity_status text;
  v_segments jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.trainer_live_is_session_trainer(p_session_id)
    OR public.trainer_live_is_session_participant_user(p_session_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT a.id, a.status
  INTO v_activity_id, v_activity_status
  FROM public.trainer_live_activity_sessions a
  WHERE a.trainer_live_session_id = p_session_id
  LIMIT 1;

  IF v_activity_id IS NULL THEN
    RETURN jsonb_build_object(
      'trainer_live_session_id', p_session_id,
      'activity_session', NULL,
      'segments', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(row_data ORDER BY ord),
    '[]'::jsonb
  )
  INTO v_segments
  FROM (
    SELECT
      s.ordinal AS ord,
      jsonb_build_object(
        'id', s.id,
        'ordinal', s.ordinal,
        'segment_type', s.segment_type,
        'label', s.label,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'amrap_session_id', s.amrap_session_id,
        'tabata_session_id', s.tabata_session_id,
        'amrap_metrics',
          CASE
            WHEN s.amrap_session_id IS NOT NULL THEN (
              WITH ap AS (
                SELECT p.id AS pid
                FROM public.amrap_participants p
                WHERE p.session_id = s.amrap_session_id
                  AND p.user_id = v_uid
                LIMIT 1
              ),
              round_counts AS (
                SELECT COUNT(*)::int AS total
                FROM public.amrap_rounds r
                WHERE r.session_id = s.amrap_session_id
                  AND r.participant_id = (SELECT pid FROM ap)
              ),
              split_stats AS (
                SELECT
                  GREATEST(
                    0,
                    r.elapsed_sec_at_round - COALESCE(
                      LAG(r.elapsed_sec_at_round) OVER (
                        PARTITION BY r.session_id, r.participant_id
                        ORDER BY r.round_index
                      ),
                      0
                    )
                  )::integer AS split_sec
                FROM public.amrap_rounds r
                WHERE r.session_id = s.amrap_session_id
                  AND r.participant_id = (SELECT pid FROM ap)
              )
              SELECT jsonb_build_object(
                'viewer_amrap_participant_id', (SELECT pid FROM ap),
                'total_rounds', (SELECT total FROM round_counts),
                'fastest_split_sec', (SELECT MIN(split_sec) FROM split_stats)
              )
            )
            ELSE NULL
          END,
        'tabata_metrics',
          CASE
            WHEN s.tabata_session_id IS NOT NULL THEN (
              SELECT jsonb_build_object(
                'tabata_session_id', t.id,
                'work_seconds', t.work_seconds,
                'rest_seconds', t.rest_seconds,
                'round_count', t.round_count,
                'state', t.state,
                'workout_list', t.workout_list
              )
              FROM public.tabata_sessions t
              WHERE t.id = s.tabata_session_id
            )
            ELSE NULL
          END
      ) AS row_data
    FROM public.trainer_live_activity_segments s
    WHERE s.activity_session_id = v_activity_id
  ) seg;

  RETURN jsonb_build_object(
    'trainer_live_session_id', p_session_id,
    'activity_session', jsonb_build_object(
      'id', v_activity_id,
      'status', v_activity_status
    ),
    'segments', COALESCE(v_segments, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_session_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_live_session_summary(uuid) IS
  'Post-workout Trainer Live summary: activity segments with viewer-scoped AMRAP metrics and Tabata state. SECURITY INVOKER; requires session trainer or participant.';
