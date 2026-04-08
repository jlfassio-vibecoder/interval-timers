-- V1: Trainer Live Featured Workouts (AMRAP / Tabata) — join table + RLS + atomic replace RPC.

CREATE TABLE IF NOT EXISTS public.trainer_featured_live_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts (id) ON DELETE CASCADE,
  context text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT trainer_featured_live_workouts_context_check
    CHECK (context IN ('trainer_live_amrap', 'trainer_live_tabata')),
  CONSTRAINT trainer_featured_live_workouts_trainer_workout_context_unique
    UNIQUE (trainer_user_id, workout_id, context),
  CONSTRAINT trainer_featured_live_workouts_trainer_context_sort_unique
    UNIQUE (trainer_user_id, context, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_trainer_featured_live_workouts_trainer_context
  ON public.trainer_featured_live_workouts (trainer_user_id, context);

COMMENT ON TABLE public.trainer_featured_live_workouts IS
  'Trainer-curated workout shortcuts for Live AMRAP/Tabata modals; order is per (trainer, context).';

ALTER TABLE public.trainer_featured_live_workouts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_featured_live_workouts TO authenticated;

-- SELECT: own rows only
DROP POLICY IF EXISTS "trainers_select_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts;

CREATE POLICY "trainers_select_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts
  FOR SELECT
  TO authenticated
  USING (trainer_user_id = auth.uid ());

-- DELETE: own rows only
DROP POLICY IF EXISTS "trainers_delete_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts;

CREATE POLICY "trainers_delete_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts
  FOR DELETE
  TO authenticated
  USING (trainer_user_id = auth.uid ());

-- INSERT: own rows + workout must belong to the authenticated trainer (anti-spoofing)
DROP POLICY IF EXISTS "trainers_insert_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts;

CREATE POLICY "trainers_insert_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    trainer_user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.workouts w
      WHERE w.id = workout_id
        AND w.trainer_id = auth.uid ()
    )
  );

-- UPDATE: own rows + if workout_id changes, new workout must still be trainer-owned
DROP POLICY IF EXISTS "trainers_update_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts;

CREATE POLICY "trainers_update_own_trainer_featured_live_workouts"
  ON public.trainer_featured_live_workouts
  FOR UPDATE
  TO authenticated
  USING (trainer_user_id = auth.uid ())
  WITH CHECK (
    trainer_user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.workouts w
      WHERE w.id = workout_id
        AND w.trainer_id = auth.uid ()
    )
  );

-- Atomic replace-all for one live context (delete + insert in one transaction).
CREATE OR REPLACE FUNCTION public.update_featured_workouts (
  p_trainer_id uuid,
  p_context text,
  p_workout_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid () IS DISTINCT FROM p_trainer_id THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_context NOT IN ('trainer_live_amrap', 'trainer_live_tabata') THEN
    RAISE EXCEPTION 'invalid context: %', p_context
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.trainer_featured_live_workouts
  WHERE trainer_user_id = p_trainer_id
    AND context = p_context;

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
    x.ord::integer
  FROM unnest(p_workout_ids) WITH ORDINALITY AS x(workout_id, ord);
END;
$$;

COMMENT ON FUNCTION public.update_featured_workouts (uuid, text, uuid[]) IS
  'Replaces featured workouts for (trainer, context); caller must be p_trainer_id. sort_order follows array order (1-based).';

REVOKE ALL ON FUNCTION public.update_featured_workouts (uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_featured_workouts (uuid, text, uuid[]) TO authenticated;
