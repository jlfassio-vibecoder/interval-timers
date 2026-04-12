-- Client hub (/trainer/live/join): suggest active trainer_live_sessions.id when the viewer is the
-- invited client or has a calendar instance linked to an active room (RLS blocks raw session SELECT
-- until they are already a participant).

CREATE OR REPLACE FUNCTION public.trainer_live_client_suggested_session()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM public.trainer_live_sessions s
  WHERE s.status = 'active'
    AND s.invited_client_user_id = v_uid
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT c.trainer_live_session_id INTO v_id
  FROM public.client_coach_schedule_instances c
  INNER JOIN public.trainer_live_sessions s
    ON s.id = c.trainer_live_session_id
   AND s.status = 'active'
  WHERE c.client_user_id = v_uid
    AND c.trainer_live_session_id IS NOT NULL
  ORDER BY c.scheduled_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_client_suggested_session() TO authenticated;
