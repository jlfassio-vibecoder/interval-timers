-- Post-workout AI insights (cardiovascular recovery assessment)
-- Linked to user_workout_logs; one insight per session (upsert by user_workout_log_id)
-- Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS public.workout_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_workout_log_id uuid NOT NULL REFERENCES public.user_workout_logs(id) ON DELETE CASCADE,
  heart_rate integer NOT NULL,
  minutes_since_last_set integer,
  notes text,
  insight_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_workout_log_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_insights_user ON public.workout_insights(user_id);

ALTER TABLE public.workout_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own workout_insights" ON public.workout_insights;
CREATE POLICY "Users can manage own workout_insights"
  ON public.workout_insights FOR ALL
  USING (auth.uid() = user_id);
