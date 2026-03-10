CREATE TABLE IF NOT EXISTS public.user_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  start_date date,
  purchased_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);
