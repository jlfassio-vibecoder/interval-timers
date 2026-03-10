-- Add email column to profiles if missing (some Supabase projects create profiles without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
    -- Backfill from auth.users for existing profiles
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND p.email IS NULL;
  END IF;
END $$;
