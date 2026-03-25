-- Minimal workout_logs + user_workout_logs for fresh local resets.
-- Mirrors apps/app/supabase/migrations/00001_initial_schema.sql (summary + set-level logs).
-- Required before 20250316010000_workout_insights.sql (FK) and later workout_logs ALTERs.

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id text,
  workout_name text NOT NULL,
  date date NOT NULL,
  effort integer NOT NULL CHECK (effort >= 1 AND effort <= 10),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON public.workout_logs(user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.user_workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id text NOT NULL,
  week_id text NOT NULL,
  workout_id text NOT NULL,
  date date NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  exercises jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_workout_logs_user_date ON public.user_workout_logs(user_id, date DESC);
