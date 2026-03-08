-- Add image columns to challenges for hero and section images (Challenge Factory)
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS section_images jsonb DEFAULT '{}';
