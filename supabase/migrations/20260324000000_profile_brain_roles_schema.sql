-- Profile as Brain: roles (host, super_admin), extended profile columns, RLS helpers
-- Run after existing profile migrations. Safe to re-run column adds (IF NOT EXISTS).

-- 0. Ensure get_my_role exists (may live in apps/app migrations; create if missing)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 1. Extend role check constraint to include host and super_admin
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'host', 'trainer', 'admin', 'super_admin'));

-- 2. Helper: true if user has admin or super_admin role (for RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin_elevated()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.get_my_role() IN ('admin', 'super_admin')
$$;

-- 3. Helper: true if user has Mission Control access (host, trainer, admin, super_admin)
CREATE OR REPLACE FUNCTION public.is_mission_control_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.get_my_role() IN ('host', 'trainer', 'admin', 'super_admin')
$$;

-- 4. Update "Admins can read all profiles" to use is_admin_elevated
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin_elevated());

-- 5. Update admin policies on other tables to use is_admin_elevated (if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment_inventory') THEN
    DROP POLICY IF EXISTS "Admin can manage equipment_inventory" ON public.equipment_inventory;
    CREATE POLICY "Admin can manage equipment_inventory" ON public.equipment_inventory
      FOR ALL USING (public.is_admin_elevated());
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment_zones') THEN
    DROP POLICY IF EXISTS "Admin can manage equipment_zones" ON public.equipment_zones;
    CREATE POLICY "Admin can manage equipment_zones" ON public.equipment_zones
      FOR ALL USING (public.is_admin_elevated());
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exercises') THEN
    DROP POLICY IF EXISTS "Admin can manage exercises" ON public.exercises;
    CREATE POLICY "Admin can manage exercises" ON public.exercises
      FOR ALL USING (public.is_admin_elevated());
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warmup_config') THEN
    DROP POLICY IF EXISTS "Admin can update warmup_config" ON public.warmup_config;
    CREATE POLICY "Admin can update warmup_config" ON public.warmup_config
      FOR UPDATE USING (public.is_admin_elevated());
    DROP POLICY IF EXISTS "Admin can insert warmup_config" ON public.warmup_config;
    CREATE POLICY "Admin can insert warmup_config" ON public.warmup_config
      FOR INSERT WITH CHECK (public.is_admin_elevated());
  END IF;
END $$;

-- 6. Add profile brain columns (phased nullable; safe IF NOT EXISTS pattern)
DO $$
BEGIN
  -- Core baseline (MET/BMR)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'date_of_birth') THEN
    ALTER TABLE public.profiles ADD COLUMN date_of_birth date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'biological_sex') THEN
    ALTER TABLE public.profiles ADD COLUMN biological_sex text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'weight_kg') THEN
    ALTER TABLE public.profiles ADD COLUMN weight_kg numeric(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'height_cm') THEN
    ALTER TABLE public.profiles ADD COLUMN height_cm numeric(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'activity_level_baseline') THEN
    ALTER TABLE public.profiles ADD COLUMN activity_level_baseline text;
  END IF;

  -- Personalization
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'primary_fitness_goal') THEN
    ALTER TABLE public.profiles ADD COLUMN primary_fitness_goal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferred_hiit_style') THEN
    ALTER TABLE public.profiles ADD COLUMN preferred_hiit_style text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'injury_limitation_tags') THEN
    ALTER TABLE public.profiles ADD COLUMN injury_limitation_tags text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'resting_hr_bpm') THEN
    ALTER TABLE public.profiles ADD COLUMN resting_hr_bpm smallint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'max_hr_bpm') THEN
    ALTER TABLE public.profiles ADD COLUMN max_hr_bpm smallint;
  END IF;

  -- Brain / behavior
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'recovery_sentiment_today') THEN
    ALTER TABLE public.profiles ADD COLUMN recovery_sentiment_today smallint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'recovery_sentiment_updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN recovery_sentiment_updated_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wearable_ecosystem') THEN
    ALTER TABLE public.profiles ADD COLUMN wearable_ecosystem text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'chronotype') THEN
    ALTER TABLE public.profiles ADD COLUMN chronotype text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'social_privacy') THEN
    ALTER TABLE public.profiles ADD COLUMN social_privacy text DEFAULT 'friends_only';
  END IF;

  -- Trainer public surface
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'trainer_bio') THEN
    ALTER TABLE public.profiles ADD COLUMN trainer_bio text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'trainer_credentials') THEN
    ALTER TABLE public.profiles ADD COLUMN trainer_credentials text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'trainer_specializations') THEN
    ALTER TABLE public.profiles ADD COLUMN trainer_specializations text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'trainer_branding') THEN
    ALTER TABLE public.profiles ADD COLUMN trainer_branding jsonb DEFAULT '{}';
  END IF;

  -- Host social surface
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'host_tagline') THEN
    ALTER TABLE public.profiles ADD COLUMN host_tagline text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'host_public_bio') THEN
    ALTER TABLE public.profiles ADD COLUMN host_public_bio text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'host_social_links') THEN
    ALTER TABLE public.profiles ADD COLUMN host_social_links jsonb DEFAULT '{}';
  END IF;

  -- Preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'units_system') THEN
    ALTER TABLE public.profiles ADD COLUMN units_system text DEFAULT 'metric';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'timezone') THEN
    ALTER TABLE public.profiles ADD COLUMN timezone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_label') THEN
    ALTER TABLE public.profiles ADD COLUMN location_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'notification_prefs') THEN
    ALTER TABLE public.profiles ADD COLUMN notification_prefs jsonb DEFAULT '{}';
  END IF;

  -- Completion tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_completed_at') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_completed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_fields_version') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_fields_version integer DEFAULT 1;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.date_of_birth IS 'Age-based HR max formulas; BMR calculation';
COMMENT ON COLUMN public.profiles.biological_sex IS 'BMR precision (Mifflin-St Jeor)';
COMMENT ON COLUMN public.profiles.weight_kg IS 'Real-time caloric burn scaling';
COMMENT ON COLUMN public.profiles.height_cm IS 'BMI and stride length estimation';
COMMENT ON COLUMN public.profiles.activity_level_baseline IS 'Sedentary vs Active multiplier for daily burn';
COMMENT ON COLUMN public.profiles.profile_completed_at IS 'Set when user completes threshold of profile fields';

-- Note: To promote product owner to super_admin, run:
--   UPDATE public.profiles SET role = 'super_admin' WHERE id = '<YOUR_UUID>';
-- Employees remain 'admin'. Hosts are promoted from client via admin or product decision.
