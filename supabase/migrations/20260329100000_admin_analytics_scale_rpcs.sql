-- Phase P6: admin analytics scale — exact aggregates via SECURITY DEFINER RPCs
-- (overview, auth funnel, engagement DAU/sessions, funnel hub launches, feature trends, quality rollups).

CREATE OR REPLACE FUNCTION public.get_admin_analytics_overview(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  total_e bigint;
  distinct_u bigint;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  SELECT COUNT(*)::bigint INTO total_e
  FROM analytics_events e
  WHERE e."timestamp" >= from_ts AND e."timestamp" <= to_ts;

  SELECT COUNT(DISTINCT e.user_id)::bigint INTO distinct_u
  FROM analytics_events e
  WHERE e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts
    AND e.user_id IS NOT NULL;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'total_events', total_e,
    'distinct_users', distinct_u
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_analytics_overview(int) IS
  'Admin overview: total analytics_events and COUNT(DISTINCT user_id) in window (exact).';

CREATE OR REPLACE FUNCTION public.get_auth_funnel_visit_count(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  visit_n bigint;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  SELECT COUNT(DISTINCT COALESCE(w.user_id::text, w.session_id))::bigint INTO visit_n
  FROM web_events w
  WHERE w.occurred_at >= from_ts
    AND w.occurred_at <= to_ts
    AND COALESCE(w.user_id::text, w.session_id) IS NOT NULL
    AND COALESCE(w.user_id::text, w.session_id) <> '';

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'visit_count', visit_n
  );
END;
$$;

COMMENT ON FUNCTION public.get_auth_funnel_visit_count(int) IS
  'Distinct visitors from web_events: COALESCE(user_id, session_id) in date range.';

CREATE OR REPLACE FUNCTION public.get_auth_funnel_activation_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  first_action_distinct bigint;
  same_day bigint := 0;
  one_two bigint := 0;
  three_seven bigint := 0;
  seven_plus bigint := 0;
  never_n bigint := 0;
  sign_ins jsonb;
  oauth_n bigint;
  email_n bigint;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  SELECT COUNT(DISTINCT e.user_id)::bigint INTO first_action_distinct
  FROM analytics_events e
  WHERE e.event_name IN ('timer_session_complete', 'hub_timer_launch_1')
    AND e.user_id IS NOT NULL
    AND e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts;

  WITH signups AS (
    SELECT e.user_id, MIN(e."timestamp") AS signup_ts
    FROM analytics_events e
    WHERE e.event_name = 'account_signup_complete'
      AND e.user_id IS NOT NULL
      AND e."timestamp" >= from_ts
      AND e."timestamp" <= to_ts
    GROUP BY e.user_id
  ),
  first_key AS (
    SELECT e.user_id, MIN(e."timestamp") AS first_key_ts
    FROM analytics_events e
    INNER JOIN signups s ON s.user_id = e.user_id
    WHERE e.event_name IN ('timer_session_complete', 'hub_timer_launch_1')
      AND e.user_id IS NOT NULL
      AND e."timestamp" >= s.signup_ts
    GROUP BY e.user_id
  ),
  joined AS (
    SELECT
      s.user_id,
      s.signup_ts,
      fk.first_key_ts,
      CASE
        WHEN fk.first_key_ts IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (fk.first_key_ts - s.signup_ts)) / 86400.0
      END AS delta_days
    FROM signups s
    LEFT JOIN first_key fk ON fk.user_id = s.user_id
  )
  SELECT
    COUNT(*) FILTER (WHERE delta_days IS NULL)::bigint,
    COUNT(*) FILTER (WHERE delta_days IS NOT NULL AND delta_days < 1)::bigint,
    COUNT(*) FILTER (WHERE delta_days IS NOT NULL AND delta_days >= 1 AND delta_days <= 2)::bigint,
    COUNT(*) FILTER (WHERE delta_days IS NOT NULL AND delta_days > 2 AND delta_days <= 7)::bigint,
    COUNT(*) FILTER (WHERE delta_days IS NOT NULL AND delta_days > 7)::bigint
  INTO never_n, same_day, one_two, three_seven, seven_plus
  FROM joined;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('date', d::text, 'count', c) ORDER BY d
    ),
    '[]'::jsonb
  )
  INTO sign_ins
  FROM (
    SELECT
      (e."timestamp" AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::bigint AS c
    FROM analytics_events e
    WHERE e.event_name = 'account_login_complete'
      AND e."timestamp" >= from_ts
      AND e."timestamp" <= to_ts
    GROUP BY 1
  ) x;

  SELECT
    COUNT(*) FILTER (WHERE e.properties->>'method' = 'oauth')::bigint,
    COUNT(*) FILTER (WHERE e.properties->>'method' = 'email')::bigint
  INTO oauth_n, email_n
  FROM analytics_events e
  WHERE e.event_name IN ('account_signup_complete', 'account_login_complete')
    AND e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'funnel_first_action_distinct_users', first_action_distinct,
    'ttfka_distribution', jsonb_build_object(
      'sameDay', same_day,
      'oneToTwoDays', one_two,
      'threeToSevenDays', three_seven,
      'sevenPlusDays', seven_plus,
      'never', never_n
    ),
    'sign_ins_by_day', sign_ins,
    'oauth_vs_email_from_events', jsonb_build_object('oauth', oauth_n, 'email', email_n)
  );
END;
$$;

COMMENT ON FUNCTION public.get_auth_funnel_activation_stats(int) IS
  'Auth funnel: first-action distinct users, TTFKA (signup in window → first key event at/after signup), sign-ins by day, OAuth/email from event properties.';

CREATE OR REPLACE FUNCTION public.get_engagement_dau_series(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  today_utc date;
  series jsonb;
  dau_i bigint := 0;
  wau_i bigint := 0;
  mau_i bigint := 0;
  stick numeric := 0;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');
  today_utc := (to_ts AT TIME ZONE 'UTC')::date;

  WITH ae_u AS (
    SELECT DISTINCT
      (e."timestamp" AT TIME ZONE 'UTC')::date AS d,
      e.user_id::text AS uid
    FROM analytics_events e
    WHERE e.user_id IS NOT NULL
      AND e."timestamp" >= from_ts
      AND e."timestamp" <= to_ts
  ),
  we_u AS (
    SELECT DISTINCT
      (w.occurred_at AT TIME ZONE 'UTC')::date AS d,
      w.user_id::text AS uid
    FROM web_events w
    WHERE w.user_id IS NOT NULL
      AND w.occurred_at >= from_ts
      AND w.occurred_at <= to_ts
  ),
  u_all AS (
    SELECT d, uid FROM ae_u
    UNION
    SELECT d, uid FROM we_u
  ),
  per_day AS (
    SELECT u.d, COUNT(DISTINCT u.uid)::bigint AS cnt
    FROM u_all u
    GROUP BY u.d
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('date', pd.d::text, 'count', pd.cnt) ORDER BY pd.d) FROM per_day pd),
      '[]'::jsonb
    ),
    COALESCE((SELECT pd.cnt FROM per_day pd ORDER BY pd.d DESC LIMIT 1), 0::bigint),
    COALESCE(
      (SELECT COUNT(DISTINCT u.uid)::bigint FROM u_all u WHERE u.d >= today_utc - 7),
      0::bigint
    ),
    COALESCE(
      (SELECT COUNT(DISTINCT u.uid)::bigint FROM u_all u WHERE u.d >= today_utc - 30),
      0::bigint
    )
  INTO series, dau_i, wau_i, mau_i;

  IF mau_i > 0 THEN
    stick := ROUND((wau_i::numeric / mau_i::numeric), 10);
  END IF;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'dau_by_day', series,
    'dau', dau_i,
    'wau', wau_i,
    'mau', mau_i,
    'stickiness', stick
  );
END;
$$;

COMMENT ON FUNCTION public.get_engagement_dau_series(int) IS
  'DAU/WAU/MAU from union of analytics_events + web_events (UTC days); WAU/MAU use rolling 7d/30d from last UTC day in window.';

CREATE OR REPLACE FUNCTION public.get_engagement_web_session_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  session_n bigint;
  avg_dur double precision;
  avg_pages double precision;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  WITH pv AS (
    SELECT
      COALESCE(NULLIF(trim(w.session_id), ''), w.user_id::text) AS sid,
      w.occurred_at
    FROM web_events w
    WHERE w.event_name = 'page_view'
      AND w.occurred_at >= from_ts
      AND w.occurred_at <= to_ts
      AND COALESCE(NULLIF(trim(w.session_id), ''), w.user_id::text) IS NOT NULL
  ),
  agg AS (
    SELECT
      sid,
      MIN(occurred_at) AS tmin,
      MAX(occurred_at) AS tmax,
      COUNT(*)::bigint AS pages
    FROM pv
    GROUP BY sid
  )
  SELECT
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) > 0
      THEN SUM(EXTRACT(EPOCH FROM (tmax - tmin)) / 60.0) / COUNT(*)::double precision
      ELSE 0::double precision
    END,
    CASE WHEN COUNT(*) > 0
      THEN SUM(pages)::double precision / COUNT(*)::double precision
      ELSE 0::double precision
    END
  INTO session_n, avg_dur, avg_pages
  FROM agg;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'session_count', session_n,
    'avg_session_duration_minutes', avg_dur,
    'avg_pages_per_session', avg_pages
  );
END;
$$;

COMMENT ON FUNCTION public.get_engagement_web_session_stats(int) IS
  'web_events page_view sessions: group by COALESCE(session_id, user_id); avg duration and pages.';

CREATE OR REPLACE FUNCTION public.get_funnel_hub_launch_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  c1 bigint;
  d1 bigint;
  c2 bigint;
  d2 bigint;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  -- Match legacy TS: only rows with user_id (logged-in) counted for totals and distincts.
  SELECT COUNT(*)::bigint INTO c1
  FROM analytics_events e
  WHERE e.event_name = 'hub_timer_launch_1'
    AND e.user_id IS NOT NULL
    AND e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts;

  SELECT COUNT(DISTINCT e.user_id)::bigint INTO d1
  FROM analytics_events e
  WHERE e.event_name = 'hub_timer_launch_1'
    AND e.user_id IS NOT NULL
    AND e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts;

  SELECT COUNT(*)::bigint INTO c2
  FROM analytics_events e
  WHERE e.event_name = 'hub_timer_launch_2'
    AND e.user_id IS NOT NULL
    AND e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts;

  SELECT COUNT(DISTINCT e.user_id)::bigint INTO d2
  FROM analytics_events e
  WHERE e.event_name = 'hub_timer_launch_2'
    AND e.user_id IS NOT NULL
    AND e."timestamp" >= from_ts
    AND e."timestamp" <= to_ts;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'hub_timer_launch_1', jsonb_build_object('event_count', c1, 'distinct_user_count', d1),
    'hub_timer_launch_2', jsonb_build_object('event_count', c2, 'distinct_user_count', d2)
  );
END;
$$;

COMMENT ON FUNCTION public.get_funnel_hub_launch_stats(int) IS
  'Activation funnel: hub_timer_launch_1/2 total events and distinct user_id (logged-in only).';

CREATE OR REPLACE FUNCTION public.get_feature_activity_daily(
  p_days int DEFAULT 30,
  p_max_days int DEFAULT 14,
  p_event_names text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  trend_from timestamptz;
  max_d int;
  rows_json jsonb;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;
  IF p_max_days < 1 OR p_max_days > 90 THEN
    RAISE EXCEPTION 'p_max_days must be between 1 and 90';
  END IF;
  from_ts := to_ts - (p_days * interval '1 day');

  IF p_event_names IS NULL OR array_length(p_event_names, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'from', to_jsonb(from_ts),
      'to', to_jsonb(to_ts),
      'trend_from', to_jsonb(from_ts),
      'rows', '[]'::jsonb
    );
  END IF;
  max_d := LEAST(p_max_days, GREATEST(p_days, 1));
  trend_from := (date_trunc('day', to_ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    - ((max_d - 1) * interval '1 day');
  IF trend_from < from_ts THEN
    trend_from := from_ts;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'event_name', event_name,
        'date', d::text,
        'count', c
      )
      ORDER BY event_name, d
    ),
    '[]'::jsonb
  )
  INTO rows_json
  FROM (
    SELECT
      e.event_name,
      (e."timestamp" AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::bigint AS c
    FROM analytics_events e
    WHERE e.event_name = ANY (p_event_names)
      AND e."timestamp" >= trend_from
      AND e."timestamp" <= to_ts
    GROUP BY e.event_name, 2
  ) x;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'trend_from', to_jsonb(trend_from),
    'rows', rows_json
  );
END;
$$;

COMMENT ON FUNCTION public.get_feature_activity_daily(int, int, text[]) IS
  'Per-day event counts for sparklines (UTC calendar days) over last LEAST(p_max_days, p_days) ending now.';

CREATE OR REPLACE FUNCTION public.get_errors_frontend_rollups(
  p_days int DEFAULT 30,
  p_top_pages int DEFAULT 20,
  p_top_messages int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  total_e bigint;
  by_page jsonb;
  top_msg jsonb;
  by_day jsonb;
BEGIN
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  SELECT COUNT(*)::bigint INTO total_e
  FROM errors_frontend ef
  WHERE ef.occurred_at >= from_ts AND ef.occurred_at <= to_ts;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('page', page, 'count', c) ORDER BY c DESC),
    '[]'::jsonb
  )
  INTO by_page
  FROM (
    SELECT COALESCE(NULLIF(trim(ef.page), ''), 'Unknown') AS page, COUNT(*)::bigint AS c
    FROM errors_frontend ef
    WHERE ef.occurred_at >= from_ts AND ef.occurred_at <= to_ts
    GROUP BY 1
    ORDER BY c DESC
    LIMIT p_top_pages
  ) x;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('message', msg, 'count', c) ORDER BY c DESC),
    '[]'::jsonb
  )
  INTO top_msg
  FROM (
    SELECT
      CASE
        WHEN length(trim(ef.message)) <= 100 THEN trim(ef.message)
        ELSE left(trim(ef.message), 100)
      END AS msg,
      COUNT(*)::bigint AS c
    FROM errors_frontend ef
    WHERE ef.occurred_at >= from_ts AND ef.occurred_at <= to_ts
    GROUP BY 1
    ORDER BY c DESC
    LIMIT p_top_messages
  ) y;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('date', d::text, 'count', c) ORDER BY d),
    '[]'::jsonb
  )
  INTO by_day
  FROM (
    SELECT
      (ef.occurred_at AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::bigint AS c
    FROM errors_frontend ef
    WHERE ef.occurred_at >= from_ts AND ef.occurred_at <= to_ts
    GROUP BY 1
  ) z;

  RETURN jsonb_build_object(
    'from', to_jsonb(from_ts),
    'to', to_jsonb(to_ts),
    'total_errors', total_e,
    'errors_by_page', by_page,
    'top_errors', top_msg,
    'errors_by_day', by_day
  );
END;
$$;

COMMENT ON FUNCTION public.get_errors_frontend_rollups(int, int, int) IS
  'Quality: errors_frontend counts by page, normalized message, and UTC day.';

-- SECURITY DEFINER admin RPCs: revoke default PUBLIC execute (repo convention; see 20250319100000_expose_shared_schema.sql).
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics_overview(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_funnel_visit_count(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_funnel_activation_stats(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_engagement_dau_series(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_engagement_web_session_stats(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_funnel_hub_launch_stats(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_feature_activity_daily(int, int, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_errors_frontend_rollups(int, int, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics_overview(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_overview(int) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_auth_funnel_visit_count(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_funnel_visit_count(int) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_auth_funnel_activation_stats(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_funnel_activation_stats(int) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_engagement_dau_series(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_engagement_dau_series(int) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_engagement_web_session_stats(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_engagement_web_session_stats(int) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_funnel_hub_launch_stats(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_funnel_hub_launch_stats(int) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_feature_activity_daily(int, int, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_feature_activity_daily(int, int, text[]) TO postgres;

GRANT EXECUTE ON FUNCTION public.get_errors_frontend_rollups(int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_errors_frontend_rollups(int, int, int) TO postgres;
