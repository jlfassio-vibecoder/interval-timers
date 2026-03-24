-- Bimodal activity: daily lifestyle baseline + workout routine (EAT modifier) + total active multiplier (TAM).
-- Idempotent ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lifestyle_baseline text,
  ADD COLUMN IF NOT EXISTS workout_routine text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS total_active_multiplier numeric(4,2);

COMMENT ON COLUMN public.profiles.lifestyle_baseline IS 'Daily routine PAL id: sedentary, low_active, active, highly_active';
COMMENT ON COLUMN public.profiles.workout_routine IS 'EAT modifier id: none, light, moderate, hard, pro';
COMMENT ON COLUMN public.profiles.total_active_multiplier IS 'TAM = lifestyle multiplier + workout modifier (capped)';

-- Backfill lifestyle from legacy activity_level_baseline
UPDATE public.profiles
SET lifestyle_baseline = CASE lower(trim(activity_level_baseline))
  WHEN 'sedentary' THEN 'sedentary'
  WHEN 'lightly_active' THEN 'low_active'
  WHEN 'moderately_active' THEN 'active'
  WHEN 'very_active' THEN 'highly_active'
  ELSE NULL
END
WHERE lifestyle_baseline IS NULL
  AND activity_level_baseline IS NOT NULL
  AND trim(activity_level_baseline) <> '';

UPDATE public.profiles
SET lifestyle_baseline = 'sedentary'
WHERE lifestyle_baseline IS NULL;

UPDATE public.profiles
SET workout_routine = 'none'
WHERE workout_routine IS NULL;

-- Backfill TAM: lifestyle (1.2 / 1.35 / 1.55 / 1.75) + workout modifier; cap at 2.5
UPDATE public.profiles
SET total_active_multiplier = LEAST(
  2.5::numeric,
  (CASE lifestyle_baseline
    WHEN 'sedentary' THEN 1.2
    WHEN 'low_active' THEN 1.35
    WHEN 'active' THEN 1.55
    WHEN 'highly_active' THEN 1.75
    ELSE 1.2
  END)
  + (CASE COALESCE(workout_routine, 'none')
    WHEN 'none' THEN 0
    WHEN 'light' THEN 0.15
    WHEN 'moderate' THEN 0.25
    WHEN 'hard' THEN 0.40
    WHEN 'pro' THEN 0.55
    ELSE 0
  END)
)
WHERE total_active_multiplier IS NULL;

-- Mirror lifestyle into legacy activity_level_baseline for old enum-based readers
UPDATE public.profiles
SET activity_level_baseline = CASE lifestyle_baseline
  WHEN 'sedentary' THEN 'sedentary'
  WHEN 'low_active' THEN 'lightly_active'
  WHEN 'active' THEN 'moderately_active'
  WHEN 'highly_active' THEN 'very_active'
  ELSE 'sedentary'
END;
