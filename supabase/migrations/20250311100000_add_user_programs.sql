-- user_programs: links users to programs (enrollment/entitlements).
-- Consolidated from apps/app/supabase/migrations 00005, 00025, 00048, 00063.
-- Fixes 404 on /rest/v1/user_programs when app fetches enrolled programs.

CREATE TABLE IF NOT EXISTS public.user_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  start_date date,
  purchased_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'trainer_assigned', 'cohort')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own user_programs" ON public.user_programs
  FOR ALL USING (auth.uid() = user_id);
