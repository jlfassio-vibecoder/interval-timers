-- Phase 6: Activation analytics events table for funnel tracking
-- Events: timer_session_complete, timer_save_click, account_land_handoff, etc.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  properties jsonb DEFAULT '{}',
  app_id text
);

-- Indexes for funnel queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_timestamp
  ON public.analytics_events (event_name, "timestamp");

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_timestamp
  ON public.analytics_events (user_id, "timestamp")
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_timestamp
  ON public.analytics_events (session_id, "timestamp")
  WHERE session_id IS NOT NULL;

-- RLS: allow INSERT for anon and authenticated; SELECT only via service role
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_events_insert_anon ON public.analytics_events;
CREATE POLICY analytics_events_insert_anon
  ON public.analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS analytics_events_insert_authenticated ON public.analytics_events;
CREATE POLICY analytics_events_insert_authenticated
  ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
