-- Ranked fitness goals (up to 3, ordered). Dual-write primary_fitness_goal = ranking[1] remains app responsibility.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'fitness_goal_ranking'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN fitness_goal_ranking text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.fitness_goal_ranking IS
  'Ordered fitness goal ids (max 3): index 0 = priority 1. Allowlist: fat_loss, cardiovascular_endurance, muscle_hypertrophy, longevity.';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_fitness_goal_ranking_cardinality;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_fitness_goal_ranking_cardinality
  CHECK (cardinality(fitness_goal_ranking) <= 3);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_fitness_goal_ranking_allowlist;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_fitness_goal_ranking_allowlist
  CHECK (
    fitness_goal_ranking <@ ARRAY[
      'fat_loss',
      'cardiovascular_endurance',
      'muscle_hypertrophy',
      'longevity'
    ]::text[]
  );

-- Uniqueness: PostgreSQL does not allow subqueries inside CHECK (0A000). Enforce with a trigger.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_fitness_goal_ranking_unique_elems;

CREATE OR REPLACE FUNCTION public.enforce_profiles_fitness_goal_ranking_distinct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n_distinct int;
BEGIN
  SELECT count(DISTINCT elem)::int INTO n_distinct
  FROM unnest(NEW.fitness_goal_ranking) AS elem;

  IF cardinality(NEW.fitness_goal_ranking) IS DISTINCT FROM n_distinct THEN
    RAISE EXCEPTION 'fitness_goal_ranking must not contain duplicate values'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_fitness_goal_ranking_distinct ON public.profiles;
CREATE TRIGGER profiles_fitness_goal_ranking_distinct
  BEFORE INSERT OR UPDATE OF fitness_goal_ranking ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profiles_fitness_goal_ranking_distinct();

-- Backfill from legacy single column when value is a valid canonical id.
UPDATE public.profiles
SET fitness_goal_ranking = ARRAY[primary_fitness_goal]::text[]
WHERE primary_fitness_goal IS NOT NULL
  AND btrim(primary_fitness_goal) <> ''
  AND primary_fitness_goal IN (
    'fat_loss',
    'cardiovascular_endurance',
    'muscle_hypertrophy',
    'longevity'
  )
  AND fitness_goal_ranking = '{}'::text[];
