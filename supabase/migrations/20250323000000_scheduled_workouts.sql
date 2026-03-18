-- Phase 5.1: Scheduled timer/interval workouts from calendar (Tabata, Daily Warm-Up, etc.).
-- AMRAP scheduled uses amrap_sessions; timer apps use this table.

CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_app text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  workout_title text,
  config jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_user_date
  ON public.scheduled_workouts (user_id, scheduled_at);

ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_workouts_select_own" ON public.scheduled_workouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scheduled_workouts_insert_own" ON public.scheduled_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scheduled_workouts_update_own" ON public.scheduled_workouts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "scheduled_workouts_delete_own" ON public.scheduled_workouts
  FOR DELETE USING (auth.uid() = user_id);
