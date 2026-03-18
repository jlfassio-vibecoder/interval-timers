-- Phase 5.9: User preference for same-day event display order.

CREATE TABLE IF NOT EXISTS public.user_event_order_preference (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  type_order text[] NOT NULL DEFAULT ARRAY['program','amrap','amrap_scheduled','timer','timer_scheduled','readiness']
);

ALTER TABLE public.user_event_order_preference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_event_order_preference_select_own" ON public.user_event_order_preference
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_event_order_preference_insert_own" ON public.user_event_order_preference
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_event_order_preference_update_own" ON public.user_event_order_preference
  FOR UPDATE USING (auth.uid() = user_id);

