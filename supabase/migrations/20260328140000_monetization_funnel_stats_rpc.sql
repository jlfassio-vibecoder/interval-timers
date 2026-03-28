-- Phase P2: monetization funnel aggregates + Stripe webhook idempotency table.

CREATE TABLE IF NOT EXISTS public.stripe_processed_webhook_events (
  stripe_event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_processed_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stripe_processed_webhook_events IS
  'Stripe webhook idempotency; rows inserted by app server (service role) only.';

CREATE OR REPLACE FUNCTION public.get_monetization_funnel_stats(p_days int DEFAULT 30)
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
  IF p_days < 1 OR p_days > 366 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 366';
  END IF;

  from_ts := to_ts - (p_days * interval '1 day');

  WITH ev AS (
    SELECT
      e.event_name,
      e.user_id,
      e.session_id,
      e."timestamp"
    FROM analytics_events e
    WHERE e."timestamp" >= from_ts
      AND e."timestamp" <= to_ts
      AND e.event_name IN (
        'monetization_pricing_viewed',
        'monetization_checkout_started',
        'monetization_checkout_completed'
      )
  ),
  names(event_name, sort_ord) AS (
    VALUES
      ('monetization_pricing_viewed', 1),
      ('monetization_checkout_started', 2),
      ('monetization_checkout_completed', 3)
  ),
  agg AS (
    SELECT
      e.event_name,
      COUNT(*)::bigint AS total_events,
      COUNT(DISTINCT e.user_id) FILTER (WHERE e.user_id IS NOT NULL)::bigint AS distinct_users,
      COUNT(DISTINCT e.session_id) FILTER (WHERE e.user_id IS NULL AND e.session_id IS NOT NULL)::bigint AS distinct_sessions
    FROM ev e
    GROUP BY e.event_name
  ),
  steps_arr AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'eventName', n.event_name,
          'label',
          CASE n.event_name
            WHEN 'monetization_pricing_viewed' THEN 'Pricing viewed'
            WHEN 'monetization_checkout_started' THEN 'Checkout started'
            WHEN 'monetization_checkout_completed' THEN 'Checkout completed (Stripe)'
            ELSE n.event_name
          END,
          'totalEvents', COALESCE(a.total_events, 0),
          'distinctUsers', COALESCE(a.distinct_users, 0),
          'distinctSessions', COALESCE(a.distinct_sessions, 0)
        )
        ORDER BY n.sort_ord
      ),
      '[]'::jsonb
    ) AS steps
    FROM names n
    LEFT JOIN agg a ON a.event_name = n.event_name
  ),
  user_pricing_eligible AS (
    SELECT COUNT(DISTINCT user_id)::numeric AS n
    FROM ev
    WHERE event_name = 'monetization_pricing_viewed'
      AND user_id IS NOT NULL
  ),
  user_pricing_to_checkout AS (
    SELECT COUNT(DISTINCT p.user_id)::numeric AS n
    FROM ev p
    INNER JOIN ev c
      ON c.user_id = p.user_id
      AND p.event_name = 'monetization_pricing_viewed'
      AND c.event_name = 'monetization_checkout_started'
      AND c."timestamp" >= p."timestamp"
    WHERE p.user_id IS NOT NULL
  ),
  user_checkout_eligible AS (
    SELECT COUNT(DISTINCT user_id)::numeric AS n
    FROM ev
    WHERE event_name = 'monetization_checkout_started'
      AND user_id IS NOT NULL
  ),
  user_checkout_to_done AS (
    SELECT COUNT(DISTINCT c.user_id)::numeric AS n
    FROM ev c
    INNER JOIN ev d
      ON d.user_id = c.user_id
      AND c.event_name = 'monetization_checkout_started'
      AND d.event_name = 'monetization_checkout_completed'
      AND d."timestamp" >= c."timestamp"
    WHERE c.user_id IS NOT NULL
  ),
  session_pricing_eligible AS (
    SELECT COUNT(DISTINCT session_id)::numeric AS n
    FROM ev
    WHERE event_name = 'monetization_pricing_viewed'
      AND user_id IS NULL
      AND session_id IS NOT NULL
  ),
  session_pricing_to_checkout AS (
    SELECT COUNT(DISTINCT p.session_id)::numeric AS n
    FROM ev p
    INNER JOIN ev c
      ON c.session_id = p.session_id
      AND p.user_id IS NULL
      AND c.user_id IS NULL
      AND p.event_name = 'monetization_pricing_viewed'
      AND c.event_name = 'monetization_checkout_started'
      AND c."timestamp" >= p."timestamp"
    WHERE p.session_id IS NOT NULL
  ),
  per_user_pc AS (
    SELECT
      user_id,
      MIN("timestamp") FILTER (WHERE event_name = 'monetization_pricing_viewed') AS t_view,
      MIN("timestamp") FILTER (WHERE event_name = 'monetization_checkout_started') AS t_click,
      MIN("timestamp") FILTER (WHERE event_name = 'monetization_checkout_completed') AS t_done
    FROM ev
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ),
  delta_view_click AS (
    SELECT EXTRACT(EPOCH FROM (t_click - t_view))::double precision AS sec
    FROM per_user_pc
    WHERE t_view IS NOT NULL
      AND t_click IS NOT NULL
      AND t_click >= t_view
  ),
  delta_click_done AS (
    SELECT EXTRACT(EPOCH FROM (t_done - t_click))::double precision AS sec
    FROM per_user_pc
    WHERE t_click IS NOT NULL
      AND t_done IS NOT NULL
      AND t_done >= t_click
  ),
  med_view_click AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY sec) AS m
    FROM delta_view_click
  ),
  med_click_done AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY sec) AS m
    FROM delta_click_done
  )
  SELECT jsonb_build_object(
    'from', to_char(from_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'to', to_char(to_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'days', p_days,
    'steps', (SELECT steps FROM steps_arr),
    'userConversions', jsonb_build_object(
      'pricingToCheckout', jsonb_build_object(
        'eligible', (SELECT n FROM user_pricing_eligible),
        'converted', (SELECT n FROM user_pricing_to_checkout),
        'rate',
        CASE
          WHEN (SELECT n FROM user_pricing_eligible) > 0
          THEN ROUND(
            ((SELECT n FROM user_pricing_to_checkout) / (SELECT n FROM user_pricing_eligible))::numeric,
            6
          )
          ELSE 0::numeric
        END
      ),
      'checkoutToCompleted', jsonb_build_object(
        'eligible', (SELECT n FROM user_checkout_eligible),
        'converted', (SELECT n FROM user_checkout_to_done),
        'rate',
        CASE
          WHEN (SELECT n FROM user_checkout_eligible) > 0
          THEN ROUND(
            ((SELECT n FROM user_checkout_to_done) / (SELECT n FROM user_checkout_eligible))::numeric,
            6
          )
          ELSE 0::numeric
        END
      )
    ),
    'sessionConversions', jsonb_build_object(
      'pricingToCheckout', jsonb_build_object(
        'eligible', (SELECT n FROM session_pricing_eligible),
        'converted', (SELECT n FROM session_pricing_to_checkout),
        'rate',
        CASE
          WHEN (SELECT n FROM session_pricing_eligible) > 0
          THEN ROUND(
            ((SELECT n FROM session_pricing_to_checkout) / (SELECT n FROM session_pricing_eligible))::numeric,
            6
          )
          ELSE 0::numeric
        END
      )
    ),
    'medianSecondsUser', jsonb_build_object(
      'pricingToCheckout', (SELECT m FROM med_view_click),
      'checkoutToCompleted', (SELECT m FROM med_click_done)
    ),
    'conversionNotes',
    'User rates require user_id on events. Anonymous checkout clicks use sessionConversions. Webhook completions may carry user_id from Checkout metadata; otherwise they do not link to prior anonymous steps.'
  )
  INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_monetization_funnel_stats(int) IS
  'Admin monetization funnel: step counts, user/session conversion rates, median seconds between steps (logged-in users only).';

GRANT EXECUTE ON FUNCTION public.get_monetization_funnel_stats(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_monetization_funnel_stats(int) TO postgres;
