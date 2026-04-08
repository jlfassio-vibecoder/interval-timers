-- Harden featured-workouts replace RPC to avoid policy/permission edge cases in hosted envs.
-- Keep auth guarantees in-function while running with definer privileges.

CREATE OR REPLACE FUNCTION public.update_featured_workouts (
  p_trainer_id uuid,
  p_context text,
  p_workout_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM p_trainer_id THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_context NOT IN ('trainer_live_amrap', 'trainer_live_tabata') THEN
    RAISE EXCEPTION 'invalid context: %', p_context
      USING ERRCODE = '23514';
  END IF;

  -- Security: every requested workout must exist and be owned by caller.
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_workout_ids, ARRAY[]::uuid[])) AS i(workout_id)
    LEFT JOIN public.workouts w
      ON w.id = i.workout_id
    WHERE w.id IS NULL
       OR w.trainer_id IS DISTINCT FROM v_uid
  ) THEN
    RAISE EXCEPTION 'one or more workouts are invalid or not owned by trainer'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.trainer_featured_live_workouts
  WHERE trainer_user_id = p_trainer_id
    AND context = p_context;

  -- Keep first occurrence order if client accidentally sends duplicate ids.
  INSERT INTO public.trainer_featured_live_workouts (
    trainer_user_id,
    workout_id,
    context,
    sort_order
  )
  SELECT
    p_trainer_id,
    x.workout_id,
    p_context,
    x.first_ord::integer
  FROM (
    SELECT i.workout_id, MIN(i.ord) AS first_ord
    FROM unnest(COALESCE(p_workout_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS i(workout_id, ord)
    GROUP BY i.workout_id
  ) AS x
  ORDER BY x.first_ord;
END;
$$;

COMMENT ON FUNCTION public.update_featured_workouts (uuid, text, uuid[]) IS
  'Replaces featured workouts for (trainer, context); caller must be p_trainer_id and own all workout ids.';

REVOKE ALL ON FUNCTION public.update_featured_workouts (uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_featured_workouts (uuid, text, uuid[]) TO authenticated;
