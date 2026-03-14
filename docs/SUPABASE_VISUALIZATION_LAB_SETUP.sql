-- Supabase Visualization Lab setup: generated_exercises, exercise_images, storage
-- Reference only. Source of truth: apps/app/supabase/migrations/ and supabase/migrations/
-- Apply via: supabase db push
-- Migrations: 00001, 00002, 00003, 00022, 00023, 00036, 00037, 00038, 00061

-- ---------------------------------------------------------------------------
-- 1. generated_exercises (from 00001_initial_schema.sql)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. exercise_images (from 00002_exercise_images.sql)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.generated_exercises(id) ON DELETE CASCADE,
  role text NOT NULL,
  image_url text NOT NULL,
  storage_path text NOT NULL,
  image_prompt text,
  visual_style text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  position integer DEFAULT 0,
  anatomical_section text,
  hidden boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_exercise_images_exercise_id ON public.exercise_images(exercise_id, position);

-- ---------------------------------------------------------------------------
-- 3. RLS: generated_exercises (from 00022, 00036, 00037)
-- ---------------------------------------------------------------------------
ALTER TABLE public.generated_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read approved exercises" ON public.generated_exercises FOR SELECT USING (status = 'approved');
CREATE POLICY "Authenticated can manage exercises" ON public.generated_exercises FOR ALL USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. RLS: exercise_images (from 00023, 00038)
-- ---------------------------------------------------------------------------
ALTER TABLE public.exercise_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage exercise_images" ON public.exercise_images FOR ALL USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 5. Storage bucket: exercise-images (from 00061_storage_exercise_images_bucket.sql)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES ('exercise-images', 'exercise-images', true, now(), now())
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads to exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete exercise-images" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to exercise-images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

CREATE POLICY "Allow authenticated select exercise-images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

CREATE POLICY "Allow authenticated update exercise-images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

CREATE POLICY "Allow authenticated delete exercise-images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);
