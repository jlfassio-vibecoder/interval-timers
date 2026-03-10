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
