-- User-saved workout templates from Universal Activity Hub (Save Workout flow).

CREATE TABLE IF NOT EXISTS public.user_saved_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  workout_set jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_workouts_user_updated
  ON public.user_saved_workouts (user_id, updated_at DESC);

ALTER TABLE public.user_saved_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_saved_workouts_select_own" ON public.user_saved_workouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_saved_workouts_insert_own" ON public.user_saved_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_saved_workouts_update_own" ON public.user_saved_workouts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_saved_workouts_delete_own" ON public.user_saved_workouts
  FOR DELETE USING (auth.uid() = user_id);
