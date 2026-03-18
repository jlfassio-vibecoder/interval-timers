-- Phase 5.6: Rest-day blocking. User can mark calendar days as rest.

CREATE TABLE IF NOT EXISTS public.user_rest_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.user_rest_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_rest_days_select_own" ON public.user_rest_days
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_rest_days_insert_own" ON public.user_rest_days
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_rest_days_delete_own" ON public.user_rest_days
  FOR DELETE USING (auth.uid() = user_id);
