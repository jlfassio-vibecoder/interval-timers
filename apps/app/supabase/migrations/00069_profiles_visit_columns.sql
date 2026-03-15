-- Add visit-tracking columns to profiles: last_sign_in_at (from Auth), sign_in_visit_count, activity_visit_count.
-- Safe to re-run: each column is added only if it does not exist.
DO $$
BEGIN
  -- last_sign_in_at (nullable; backfill from auth.users)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_sign_in_at') THEN
    ALTER TABLE public.profiles ADD COLUMN last_sign_in_at timestamptz;
    UPDATE public.profiles p SET last_sign_in_at = u.last_sign_in_at FROM auth.users u WHERE p.id = u.id;
  END IF;
  -- sign_in_visit_count (explicit sign-ins)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sign_in_visit_count') THEN
    ALTER TABLE public.profiles ADD COLUMN sign_in_visit_count integer NOT NULL DEFAULT 0;
  END IF;
  -- activity_visit_count (resumed activity visits)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'activity_visit_count') THEN
    ALTER TABLE public.profiles ADD COLUMN activity_visit_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
