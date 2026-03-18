-- Run this once in Supabase Dashboard → SQL Editor (project: the one your app uses).
-- Fixes 404 for scheduled_workouts and user_rest_days.

-- 1. scheduled_workouts (Phase 5.1)
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
DROP POLICY IF EXISTS "scheduled_workouts_select_own" ON public.scheduled_workouts;
CREATE POLICY "scheduled_workouts_select_own" ON public.scheduled_workouts
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "scheduled_workouts_insert_own" ON public.scheduled_workouts;
CREATE POLICY "scheduled_workouts_insert_own" ON public.scheduled_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "scheduled_workouts_update_own" ON public.scheduled_workouts;
CREATE POLICY "scheduled_workouts_update_own" ON public.scheduled_workouts
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "scheduled_workouts_delete_own" ON public.scheduled_workouts;
CREATE POLICY "scheduled_workouts_delete_own" ON public.scheduled_workouts
  FOR DELETE USING (auth.uid() = user_id);

-- 2. user_rest_days (Phase 5.6)
CREATE TABLE IF NOT EXISTS public.user_rest_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.user_rest_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_rest_days_select_own" ON public.user_rest_days;
CREATE POLICY "user_rest_days_select_own" ON public.user_rest_days
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_rest_days_insert_own" ON public.user_rest_days;
CREATE POLICY "user_rest_days_insert_own" ON public.user_rest_days
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_rest_days_delete_own" ON public.user_rest_days;
CREATE POLICY "user_rest_days_delete_own" ON public.user_rest_days
  FOR DELETE USING (auth.uid() = user_id);
