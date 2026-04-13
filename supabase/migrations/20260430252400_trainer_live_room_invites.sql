-- Ad-hoc Trainer Live room invites (multi-client) — distinct from scheduled
-- `trainer_live_session_invites` (occurrence-based calendar invites).

CREATE TABLE IF NOT EXISTS public.trainer_live_room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_live_session_id uuid NOT NULL REFERENCES public.trainer_live_sessions (id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_live_room_invites_session_invitee_key UNIQUE (trainer_live_session_id, invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_live_room_invites_session
  ON public.trainer_live_room_invites (trainer_live_session_id);

CREATE INDEX IF NOT EXISTS idx_trainer_live_room_invites_invitee
  ON public.trainer_live_room_invites (invitee_user_id);

COMMENT ON TABLE public.trainer_live_room_invites IS
  'In-app invites from trainer to roster clients for an active ad-hoc trainer_live_sessions row; join auth unchanged (open rooms).';

ALTER TABLE public.trainer_live_room_invites ENABLE ROW LEVEL SECURITY;

-- Trainers see invites for their own sessions
CREATE POLICY trainer_live_room_invites_select_trainer
  ON public.trainer_live_room_invites FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_live_sessions s
      WHERE s.id = trainer_live_room_invites.trainer_live_session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

-- Invitees see their own invite rows
CREATE POLICY trainer_live_room_invites_select_invitee
  ON public.trainer_live_room_invites FOR SELECT TO authenticated
  USING (invitee_user_id = (SELECT auth.uid()));

-- Inserts go through SECURITY DEFINER RPC only; no direct INSERT policy for clients

CREATE OR REPLACE FUNCTION public.trainer_live_invite_clients_to_session(
  p_session_id uuid,
  p_client_user_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_trainer uuid;
  v_invited uuid;
  v_uid uuid := auth.uid();
  v_bad int;
  v_inserted bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_mission_control_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT s.trainer_user_id, s.invited_client_user_id
  INTO v_trainer, v_invited
  FROM public.trainer_live_sessions s
  WHERE s.id = p_session_id AND s.status = 'active';

  IF v_trainer IS NULL THEN
    RAISE EXCEPTION 'Session not found or ended';
  END IF;

  IF v_trainer IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not the host of this session';
  END IF;

  IF v_invited IS NOT NULL THEN
    RAISE EXCEPTION 'This session is reserved for one client; in-app roster invites are not available';
  END IF;

  IF p_client_user_ids IS NULL OR cardinality(p_client_user_ids) = 0 THEN
    RETURN jsonb_build_object('inserted', 0);
  END IF;

  SELECT count(*) INTO v_bad
  FROM (
    SELECT DISTINCT x AS cid
    FROM unnest(p_client_user_ids) AS x
    WHERE x IS NOT NULL AND x IS DISTINCT FROM v_uid
  ) d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_programs up
    INNER JOIN public.programs pr ON pr.id = up.program_id
    WHERE up.user_id = d.cid
      AND pr.trainer_id = v_trainer
  );

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'One or more selected users are not on your roster';
  END IF;

  WITH ins AS (
    INSERT INTO public.trainer_live_room_invites (trainer_live_session_id, invitee_user_id)
    SELECT p_session_id, d.cid
    FROM (
      SELECT DISTINCT x AS cid
      FROM unnest(p_client_user_ids) AS x
      WHERE x IS NOT NULL AND x IS DISTINCT FROM v_uid
    ) d
    ON CONFLICT (trainer_live_session_id, invitee_user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object('inserted', COALESCE(v_inserted, 0)::int);
END;
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_client_pending_invites()
RETURNS TABLE (
  session_id uuid,
  trainer_display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    i.trainer_live_session_id AS session_id,
    COALESCE(
      NULLIF(trim(t.display_name), ''),
      NULLIF(trim(p.full_name), ''),
      NULLIF(trim(p.username), ''),
      'Trainer'
    ) AS trainer_display_name
  FROM public.trainer_live_room_invites i
  INNER JOIN public.trainer_live_sessions s
    ON s.id = i.trainer_live_session_id
   AND s.status = 'active'
  INNER JOIN public.profiles p ON p.id = s.trainer_user_id
  LEFT JOIN public.trainers t ON t.user_id = p.id
  WHERE i.invitee_user_id = (SELECT auth.uid())
    AND NOT EXISTS (
      SELECT 1
      FROM public.trainer_live_participants p2
      WHERE p2.session_id = i.trainer_live_session_id
        AND p2.role = 'client'
        AND p2.user_id = (SELECT auth.uid())
    )
  ORDER BY i.invited_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_invite_clients_to_session(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_client_pending_invites() TO authenticated;
