-- Firebase to Supabase migration: initial schema
-- Run in Supabase SQL Editor or via: supabase db push

-- Extend profiles (assumes public.profiles exists from Supabase Auth; if not, create it)
-- Typically created by Supabase Auth with: id, email, raw_user_meta_data, etc.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'trainer', 'admin')),
  purchased_index integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workout logs (was Firestore 'logs')
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id text,
  workout_name text NOT NULL,
  date date NOT NULL,
  effort integer NOT NULL CHECK (effort >= 1 AND effort <= 10),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON public.workout_logs(user_id, date DESC);

-- Set-level workout logs (users/{uid}/workout_logs style)
CREATE TABLE IF NOT EXISTS public.user_workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id text NOT NULL,
  week_id text NOT NULL,
  workout_id text NOT NULL,
  date date NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  exercises jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_workout_logs_user_date ON public.user_workout_logs(user_id, date DESC);

-- Programs (may already exist in your project; create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programs') THEN
    CREATE TABLE public.programs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      difficulty text DEFAULT 'intermediate',
      duration_weeks integer DEFAULT 4,
      tags text[] DEFAULT '{}',
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
      is_public boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Program weeks (was Firestore programs/{id}/weeks)
CREATE TABLE IF NOT EXISTS public.program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  content jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, week_number)
);

-- Workouts (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workouts') THEN
    CREATE TABLE public.workouts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
      trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      duration_minutes integer,
      difficulty_level text,
      blocks jsonb DEFAULT '[]',
      status text DEFAULT 'active',
      scheduled_week integer,
      scheduled_day integer,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Challenges (Firestore 'challenges')
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  config jsonb,
  chain_metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  content jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, week_number)
);

-- Admin exercises (Firestore 'exercises')
CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('strength', 'cardio', 'mobility')),
  muscle_groups text[] DEFAULT '{}',
  video_url text,
  default_equipment text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Equipment (Firestore 'equipment_inventory', 'equipment_zones')
CREATE TABLE IF NOT EXISTS public.equipment_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('resistance', 'cardio', 'utility')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('domestic', 'commercial', 'amenity', 'outdoor')),
  description text DEFAULT '',
  biomechanical_constraints text[] DEFAULT '{}',
  equipment_ids text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Warmup config (Firestore 'warmup_config' single doc)
CREATE TABLE IF NOT EXISTS public.warmup_config (
  id text PRIMARY KEY DEFAULT 'default',
  slots jsonb NOT NULL DEFAULT '[]',
  duration_per_exercise integer NOT NULL DEFAULT 30,
  updated_at timestamptz DEFAULT now()
);

-- Generated exercises (Firestore 'generated_exercises')
CREATE TABLE IF NOT EXISTS public.generated_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  exercise_name text NOT NULL,
  image_url text,
  storage_path text,
  kinetic_chain_type text,
  biomechanics jsonb,
  image_prompt text,
  complexity_level text,
  visual_style text,
  sources jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  generated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  deep_dive_html_content text,
  suitable_blocks text[],
  main_workout_type text,
  video_url text,
  video_storage_path text,
  videos jsonb DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_exercises_slug_status ON public.generated_exercises(slug, status) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_generated_exercises_status_created ON public.generated_exercises(status, created_at DESC);
