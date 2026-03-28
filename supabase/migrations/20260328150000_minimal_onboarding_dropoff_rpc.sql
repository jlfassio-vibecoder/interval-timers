-- Phase P3: minimal onboarding step drop-off (diagnostic), cohort = users with viewed event in window.

CREATE OR REPLACE FUNCTION public.get_minimal_onboarding_dropoff(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  v_cnt bigint;
  vb_cnt bigint;
  vg_cnt bigint;
  vc_cnt bigint;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  WITH bounds AS (
    SELECT from_ts AS ts_from, to_ts AS ts_to
  ),
  v AS (
    SELECT DISTINCT e.user_id
    FROM analytics_events e
    CROSS JOIN bounds b
    WHERE e.event_name = 'minimal_onboarding_viewed'
      AND e."timestamp" >= b.ts_from
      AND e."timestamp" <= b.ts_to
      AND e.user_id IS NOT NULL
  ),
  in_b AS (
    SELECT DISTINCT e.user_id
    FROM analytics_events e
    CROSS JOIN bounds b
    WHERE e.event_name = 'minimal_onboarding_baseline_saved'
      AND e."timestamp" >= b.ts_from
      AND e."timestamp" <= b.ts_to
      AND e.user_id IS NOT NULL
  ),
  in_g AS (
    SELECT DISTINCT e.user_id
    FROM analytics_events e
    CROSS JOIN bounds b
    WHERE e.event_name = 'minimal_onboarding_goals_saved'
      AND e."timestamp" >= b.ts_from
      AND e."timestamp" <= b.ts_to
      AND e.user_id IS NOT NULL
  ),
  in_c AS (
    SELECT DISTINCT e.user_id
    FROM analytics_events e
    CROSS JOIN bounds b
    WHERE e.event_name = 'minimal_onboarding_complete'
      AND e."timestamp" >= b.ts_from
      AND e."timestamp" <= b.ts_to
      AND e.user_id IS NOT NULL
  ),
  vb AS (
    SELECT v.user_id
    FROM v
    INNER JOIN in_b ON in_b.user_id = v.user_id
  ),
  vg AS (
    SELECT vb.user_id
    FROM vb
    INNER JOIN in_g ON in_g.user_id = vb.user_id
  ),
  vc AS (
    SELECT vg.user_id
    FROM vg
    INNER JOIN in_c ON in_c.user_id = vg.user_id
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM v),
    (SELECT COUNT(*)::bigint FROM vb),
    (SELECT COUNT(*)::bigint FROM vg),
    (SELECT COUNT(*)::bigint FROM vc)
  INTO v_cnt, vb_cnt, vg_cnt, vc_cnt;

  IF v_cnt = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN jsonb_build_array(
    jsonb_build_object(
      'step', 'Landed (page viewed)',
      'completed', v_cnt,
      'dropped', 0::bigint
    ),
    jsonb_build_object(
      'step', 'Baseline saved',
      'completed', vb_cnt,
      'dropped', v_cnt - vb_cnt
    ),
    jsonb_build_object(
      'step', 'Goals ranking saved',
      'completed', vg_cnt,
      'dropped', vb_cnt - vg_cnt
    ),
    jsonb_build_object(
      'step', 'Onboarding complete',
      'completed', vc_cnt,
      'dropped', vg_cnt - vc_cnt
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_minimal_onboarding_dropoff(int) IS
  'Admin diagnostic: sequential drop-off for /account/onboarding/minimal; cohort = distinct user_id with minimal_onboarding_viewed in window; later steps require prior milestones in the same window.';

REVOKE EXECUTE ON FUNCTION public.get_minimal_onboarding_dropoff(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_minimal_onboarding_dropoff(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_minimal_onboarding_dropoff(int) TO postgres;
