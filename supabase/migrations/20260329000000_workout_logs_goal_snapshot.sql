-- Hybrid goal intent: copy ranked profile goals at workout log insert time (spec §3.2).

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS goal_snapshot text[];

COMMENT ON COLUMN public.workout_logs.goal_snapshot IS
  'Ordered fitness goal ids from profiles.fitness_goal_ranking at insert; NULL when user had no ranked goals.';

CREATE OR REPLACE FUNCTION public.workout_logs_fill_goal_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ranking text[];
BEGIN
  IF NEW.goal_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.fitness_goal_ranking INTO v_ranking
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF v_ranking IS NULL OR cardinality(v_ranking) = 0 THEN
    NEW.goal_snapshot := NULL;
  ELSE
    NEW.goal_snapshot := v_ranking;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_logs_fill_goal_snapshot_on_insert ON public.workout_logs;
CREATE TRIGGER workout_logs_fill_goal_snapshot_on_insert
  BEFORE INSERT ON public.workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.workout_logs_fill_goal_snapshot();
