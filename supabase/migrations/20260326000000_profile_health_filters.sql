-- Profile health filters: physical limitations, medical conditions, pregnancy/postpartum.
-- Backfill from legacy injury_limitation_tags (engine-aligned ids for physical).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'physical_limitations'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN physical_limitations text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'medical_conditions'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN medical_conditions text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'pregnancy_postpartum'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN pregnancy_postpartum text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Map legacy profile tags to INJURY_RULES injury ids (hyphenated).
UPDATE public.profiles
SET physical_limitations = COALESCE(
  ARRAY(
    SELECT CASE elem
      WHEN 'lower_back' THEN 'lower-back'
      ELSE elem
    END
    FROM unnest(injury_limitation_tags) AS elem
  ),
  '{}'::text[]
)
WHERE injury_limitation_tags IS NOT NULL
  AND array_length(injury_limitation_tags, 1) IS NOT NULL
  AND array_length(injury_limitation_tags, 1) > 0
  AND physical_limitations = '{}'::text[];
