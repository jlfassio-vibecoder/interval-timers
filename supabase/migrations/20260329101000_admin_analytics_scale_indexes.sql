-- Phase P6: support admin engagement session queries on web_events (page_view + occurred_at).

CREATE INDEX IF NOT EXISTS idx_web_events_event_name_occurred_at
  ON public.web_events (event_name, occurred_at);
