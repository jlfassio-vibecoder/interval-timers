-- Phase 1: Acquisition analytics — page views and traffic (web_events).
-- Used for unique visitors, referrers, UTM, landing pages, device/browser, geo.

CREATE TABLE IF NOT EXISTS public.web_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL DEFAULT 'page_view',
  session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  path text NOT NULL,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_agent text,
  ip_country text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  properties jsonb DEFAULT '{}',
  app_id text
);

CREATE INDEX IF NOT EXISTS idx_web_events_occurred_at
  ON public.web_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_web_events_session_occurred
  ON public.web_events (session_id, occurred_at)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_web_events_user_occurred
  ON public.web_events (user_id, occurred_at)
  WHERE user_id IS NOT NULL;

-- RLS: allow INSERT for anon and authenticated; SELECT only via service role
ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_events_insert_anon ON public.web_events;
CREATE POLICY web_events_insert_anon
  ON public.web_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS web_events_insert_authenticated ON public.web_events;
CREATE POLICY web_events_insert_authenticated
  ON public.web_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
