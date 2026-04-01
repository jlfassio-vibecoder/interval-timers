-- Workout Factory: workout_sets (admin AI-generated sets). Mirrors apps/app/supabase/migrations/00056_workout_sets.sql.
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  config jsonb,
  chain_metadata jsonb,
  workouts jsonb NOT NULL DEFAULT '[]',
  workout_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_created ON public.workout_sets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_status_created ON public.workout_sets(status, created_at DESC);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.workout_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;

DROP POLICY IF EXISTS "Authors can manage own workout_sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Anyone can read published workout_sets" ON public.workout_sets;

CREATE POLICY "Authors can manage own workout_sets"
  ON public.workout_sets
  FOR ALL
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Anyone can read published workout_sets"
  ON public.workout_sets
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

COMMENT ON TABLE public.workout_sets IS 'Workout Factory AI-generated sets (distinct from public.workouts).';
