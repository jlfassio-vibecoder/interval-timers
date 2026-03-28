-- Program Factory / admin UI inserts programs with the browser Supabase client (authenticated JWT).
-- If RLS is enabled on public.programs without policies, PostgREST returns 403 on INSERT.
-- This migration aligns hosted DBs with apps/app/supabase/migrations/00032–00033 policies.

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;

DROP POLICY IF EXISTS "Trainers can manage own programs" ON public.programs;
DROP POLICY IF EXISTS "Anyone can read public programs" ON public.programs;

-- Authenticated users may CRUD rows where they are the trainer (hosts and trainers both use trainer_id = auth.uid()).
CREATE POLICY "Trainers can manage own programs"
  ON public.programs
  FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

-- Catalog / published programs readable without owning the row.
CREATE POLICY "Anyone can read public programs"
  ON public.programs
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

COMMENT ON POLICY "Trainers can manage own programs" ON public.programs IS
  'Allows authenticated users to create and manage programs they own (trainer_id = auth.uid()).';
