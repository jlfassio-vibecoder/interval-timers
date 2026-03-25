-- Multi-select preferred HIIT timer protocols; legacy preferred_hiit_style remains for first-choice sync.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_hiit_styles text[] NOT NULL DEFAULT '{}';

UPDATE public.profiles
SET preferred_hiit_styles = ARRAY[trim(preferred_hiit_style)]::text[]
WHERE preferred_hiit_style IS NOT NULL
  AND trim(preferred_hiit_style) <> ''
  AND cardinality(preferred_hiit_styles) = 0;

COMMENT ON COLUMN public.profiles.preferred_hiit_styles IS
  'User preferred interval timer protocol ids (multi-select); see apps/app intervalTimerProtocols.';
