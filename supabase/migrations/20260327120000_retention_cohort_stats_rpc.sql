-- Admin retention cohort stats: signup cohort (profiles.created_at bucket) × relative period activity.
-- "Active" = at least one analytics_events or web_events row in that period with user_id set.
-- Cohort window: users whose profile was created between now()-p_days and now().

CREATE OR REPLACE FUNCTION public.get_retention_cohort_stats(
  p_days int DEFAULT 30,
  p_granularity text DEFAULT 'week',
  p_max_periods int DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  activity_end_ts timestamptz;
  result jsonb;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;
  IF p_granularity NOT IN ('week', 'month') THEN
    RAISE EXCEPTION 'p_granularity must be week or month';
  END IF;
  IF p_max_periods < 1 OR p_max_periods > 24 THEN
    RAISE EXCEPTION 'p_max_periods must be between 1 and 24';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  IF p_granularity = 'week' THEN
    activity_end_ts := to_ts + (p_max_periods * interval '1 week');
  ELSE
    activity_end_ts := to_ts + (p_max_periods * interval '1 month');
  END IF;

  WITH cohort_users AS (
    SELECT
      p.id AS user_id,
      date_trunc(p_granularity, p.created_at) AS cohort_bucket
    FROM profiles p
    WHERE p.created_at IS NOT NULL
      AND p.created_at >= from_ts
      AND p.created_at <= to_ts
  ),
  cohort_sizes AS (
    SELECT cohort_bucket, COUNT(*)::bigint AS cohort_size
    FROM cohort_users
    GROUP BY cohort_bucket
  ),
  activity_dedup AS (
    SELECT DISTINCT
      x.user_id,
      date_trunc(p_granularity, x.ts) AS activity_bucket
    FROM (
      SELECT user_id, "timestamp" AS ts
      FROM analytics_events
      WHERE user_id IS NOT NULL
      UNION ALL
      SELECT user_id, occurred_at AS ts
      FROM web_events
      WHERE user_id IS NOT NULL
    ) x
    WHERE x.ts >= from_ts
      AND x.ts <= activity_end_ts
  ),
  cohort_periods AS (
    SELECT
      c.cohort_bucket,
      c.cohort_size,
      gs.k AS period_offset,
      (
        SELECT COUNT(DISTINCT cu.user_id)::bigint
        FROM cohort_users cu
        WHERE cu.cohort_bucket = c.cohort_bucket
          AND EXISTS (
            SELECT 1
            FROM activity_dedup ad
            WHERE ad.user_id = cu.user_id
              AND ad.activity_bucket = c.cohort_bucket + (
                CASE
                  WHEN p_granularity = 'week' THEN (gs.k * interval '1 week')
                  ELSE (gs.k * interval '1 month')
                END
              )
          )
      ) AS active_count
    FROM cohort_sizes c
    CROSS JOIN generate_series(0, p_max_periods - 1) AS gs(k)
  ),
  cohort_json AS (
    SELECT
      cb.cohort_bucket,
      jsonb_build_object(
        'cohortStart', to_char((cb.cohort_bucket AT TIME ZONE 'UTC'), 'YYYY-MM-DD'),
        'label', to_char((cb.cohort_bucket AT TIME ZONE 'UTC'), 'YYYY-MM-DD'),
        'cohortSize', cb.cohort_size,
        'periods', jsonb_agg(
          jsonb_build_object(
            'offset', cp.period_offset,
            'activeCount', cp.active_count,
            'retentionRate',
            CASE
              WHEN cb.cohort_size > 0 THEN round((cp.active_count::numeric / cb.cohort_size::numeric), 4)
              ELSE 0::numeric
            END
          )
          ORDER BY cp.period_offset
        )
      ) AS obj
    FROM (
      SELECT DISTINCT cohort_bucket, cohort_size FROM cohort_sizes
    ) cb
    JOIN cohort_periods cp ON cp.cohort_bucket = cb.cohort_bucket AND cp.cohort_size = cb.cohort_size
    GROUP BY cb.cohort_bucket, cb.cohort_size
  )
  SELECT COALESCE(
    jsonb_agg(cj.obj ORDER BY cj.cohort_bucket),
    '[]'::jsonb
  )
  INTO result
  FROM cohort_json cj;

  RETURN jsonb_build_object(
    'from', to_char(from_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'to', to_char(to_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'granularity', p_granularity,
    'maxPeriods', p_max_periods,
    'cohortAnchor', 'profiles.created_at',
    'activeDefinition', 'distinct user_id with >=1 analytics_events or web_events in bucket; anonymous excluded',
    'cohorts', COALESCE(result, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_retention_cohort_stats(int, text, int) IS
  'Admin cohort retention: rows = signup cohort buckets in window; columns = period offsets; rate = activeCount/cohortSize.';

REVOKE EXECUTE ON FUNCTION public.get_retention_cohort_stats(int, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retention_cohort_stats(int, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_retention_cohort_stats(int, text, int) TO postgres;
