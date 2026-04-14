-- Room invites on Account: list while session is active even after the client joined and left the UI.
-- Leaving only clears client sessionStorage; trainer_live_participants still exists, so the old
-- NOT EXISTS(participant) filter hid the invite. Clients rejoin via the same link until the host ends.

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
  ORDER BY i.invited_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_client_pending_invites() TO authenticated;
