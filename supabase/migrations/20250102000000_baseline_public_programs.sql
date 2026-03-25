-- Baseline `public.programs` for local `supabase db reset`.
-- `20250311100000_add_user_programs.sql` FK-references this table; production likely created
-- programs from an older app migration not present in this repo.

CREATE TABLE IF NOT EXISTS public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived'))
);

COMMENT ON TABLE public.programs IS 'Trainer programs catalog; baseline for user_programs FK.';
