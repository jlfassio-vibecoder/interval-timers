-- Baseline `public.profiles` so local `supabase db reset` can apply migrations in order.
-- AMRAP HUD (20250310000000) and later migrations ALTER this table; production may have
-- originated this table from the Supabase dashboard or an older migration not in this repo.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  updated_at timestamptz,
  username text,
  full_name text,
  avatar_url text,
  website text,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'trainer', 'admin'))
);

COMMENT ON TABLE public.profiles IS 'User profile; baseline row for auth.users. Extended by later migrations.';
