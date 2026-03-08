-- User-friendly instructions for public exercise page (AI-generated, plain language).
-- When present, shown as main content; biomechanics move to "Learn More" section.
ALTER TABLE public.generated_exercises
  ADD COLUMN IF NOT EXISTS user_friendly_instructions text;
