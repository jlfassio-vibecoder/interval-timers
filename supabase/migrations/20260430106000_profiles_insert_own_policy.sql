-- Allow authenticated users to insert their own profile row.
-- Needed when service role is unavailable and server APIs rely on a user-JWT client under RLS.
-- Mirrors apps/app/supabase policies (read/update) but adds INSERT for id = auth.uid().

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "Users can insert own profile" ON public.profiles IS
  'Allows an authenticated user to create their own profiles row (id = auth.uid()).';

