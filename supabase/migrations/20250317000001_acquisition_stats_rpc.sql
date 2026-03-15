-- RPC for Phase 1 acquisition stats (avoids pulling large web_events into app).
-- Returns JSON: uniqueVisitorsByDay, topReferrers, utmBreakdown, topLandingPages, deviceBrowser, geo.

CREATE OR REPLACE FUNCTION public.get_acquisition_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_ts timestamptz;
  to_ts timestamptz := now();
  result jsonb;
BEGIN
  from_ts := to_ts - (p_days * interval '1 day');

  WITH params AS (SELECT from_ts AS f, to_ts AS t),
  events AS (
    SELECT
      date_trunc('day', occurred_at)::date AS day,
      coalesce(user_id::text, session_id) AS visitor_key,
      path,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      user_agent,
      ip_country,
      session_id,
      occurred_at,
      row_number() OVER (PARTITION BY session_id ORDER BY occurred_at ASC) AS rn
    FROM web_events
    WHERE occurred_at >= (SELECT f FROM params)
      AND occurred_at <= (SELECT t FROM params)
  ),
  visitors_by_day AS (
    SELECT to_char(day, 'YYYY-MM-DD') AS date, count(DISTINCT visitor_key) AS count
    FROM events
    GROUP BY day
    ORDER BY day
  ),
  referrers AS (
    SELECT referrer, count(*) AS count
    FROM events
    WHERE referrer IS NOT NULL AND referrer <> ''
    GROUP BY referrer
    ORDER BY count DESC
    LIMIT 20
  ),
  utm AS (
    SELECT
      coalesce(utm_source, '(none)') AS source,
      coalesce(utm_medium, '(none)') AS medium,
      coalesce(utm_campaign, '(none)') AS campaign,
      count(*) AS count
    FROM events
    GROUP BY utm_source, utm_medium, utm_campaign
    ORDER BY count DESC
  ),
  landing AS (
    SELECT path, count(*) AS count
    FROM events
    WHERE rn = 1
    GROUP BY path
    ORDER BY count DESC
    LIMIT 20
  ),
  geo AS (
    SELECT coalesce(ip_country, '(unknown)') AS country, count(*) AS count
    FROM events
    WHERE ip_country IS NOT NULL AND ip_country <> ''
    GROUP BY ip_country
    ORDER BY count DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'uniqueVisitorsByDay', (SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count) ORDER BY date) FROM visitors_by_day),
    'topReferrers', (SELECT jsonb_agg(jsonb_build_object('referrer', referrer, 'count', count)) FROM referrers),
    'utmBreakdown', (SELECT jsonb_agg(jsonb_build_object('source', source, 'medium', medium, 'campaign', campaign, 'count', count)) FROM utm),
    'topLandingPages', (SELECT jsonb_agg(jsonb_build_object('path', path, 'count', count)) FROM landing),
    'geo', (SELECT jsonb_agg(jsonb_build_object('country', country, 'count', count)) FROM geo)
  ) INTO result;

  -- deviceBrowser: we don't parse user_agent in SQL; return empty and let app parse if needed
  result := result || jsonb_build_object('deviceBrowser', '[]'::jsonb);

  RETURN result;
END;
$$;
