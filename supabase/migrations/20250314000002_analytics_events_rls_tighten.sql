-- Tighten analytics_events RLS to prevent user impersonation.
-- anon: can only insert anonymous events (user_id must be null).
-- authenticated: user_id must be null or auth.uid() (no spoofing other users).

DROP POLICY IF EXISTS analytics_events_insert_anon ON public.analytics_events;
DROP POLICY IF EXISTS analytics_events_insert_authenticated ON public.analytics_events;

CREATE POLICY analytics_events_insert_anon
  ON public.analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY analytics_events_insert_authenticated
  ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
