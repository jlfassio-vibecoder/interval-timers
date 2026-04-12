-- Trainer Live Tabata: allow host to update workout_list (drag/reorder in embed UI).
-- Mirrors validation from trainer_live_attach_tabata_session / tabata_session_apply_patch auth.

CREATE OR REPLACE FUNCTION public.tabata_session_set_workout_list(
  p_tabata_session_id uuid,
  p_workout_list jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tl uuid;
  v_elem jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_workout_list IS NULL OR jsonb_typeof(p_workout_list) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_workout_list must be a JSON array';
  END IF;

  IF jsonb_array_length(p_workout_list) < 1 THEN
    RAISE EXCEPTION 'p_workout_list must contain at least one exercise';
  END IF;

  FOR v_elem IN SELECT jsonb_array_elements(p_workout_list)
  LOOP
    IF jsonb_typeof(v_elem) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Each workout entry must be a string';
    END IF;
    IF v_elem #>> '{}' IS NULL OR length(trim(v_elem #>> '{}')) < 1 THEN
      RAISE EXCEPTION 'Each workout entry must be a non-empty string';
    END IF;
  END LOOP;

  SELECT trainer_live_session_id INTO v_tl
  FROM public.tabata_sessions
  WHERE id = p_tabata_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tabata session not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trainer_live_sessions s
    WHERE s.id = v_tl AND s.trainer_user_id = v_uid AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.tabata_sessions
  SET workout_list = p_workout_list
  WHERE id = p_tabata_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tabata_session_set_workout_list(uuid, jsonb) TO authenticated;
