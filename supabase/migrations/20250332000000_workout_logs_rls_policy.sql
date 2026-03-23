-- Add RLS policy for workout_logs so authenticated users can INSERT/SELECT/UPDATE/DELETE own rows.
-- Without this policy, RLS blocks all operations (403). Required for handoff saves (Daily Warm-Up, Tabata, etc.).
-- Enable RLS explicitly (idempotent: no-op if already enabled) so migration works in fresh environments.
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own workout_logs" ON public.workout_logs;
CREATE POLICY "Users can manage own workout_logs" ON public.workout_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
