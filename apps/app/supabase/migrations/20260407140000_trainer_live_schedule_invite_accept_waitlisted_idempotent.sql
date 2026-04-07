-- Allow trainer_live_schedule_invite_accept to be idempotent for waitlisted invites (HUD "stay on waitlist").
CREATE OR REPLACE FUNCTION public.trainer_live_schedule_invite_accept(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_occ uuid;
  v_status text;
  v_invitee uuid;
  n_accepted int;
  n_wait int;
  cap int := 6;
  wait_cap int := 2;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT occurrence_id, status, invitee_user_id
  INTO v_occ, v_status, v_invitee
  FROM public.trainer_live_session_invites
  WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invite not found');
  END IF;

  IF v_invitee IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Complete roster invite signup before accepting');
  END IF;

  IF v_invitee IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF v_status = 'waitlisted' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'waitlisted');
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invite not pending');
  END IF;

  PERFORM 1 FROM public.trainer_live_session_occurrences WHERE id = v_occ FOR UPDATE;

  SELECT count(*)::int INTO n_accepted
  FROM public.trainer_live_session_invites
  WHERE occurrence_id = v_occ AND status = 'accepted';

  SELECT count(*)::int INTO n_wait
  FROM public.trainer_live_session_invites
  WHERE occurrence_id = v_occ AND status = 'waitlisted';

  IF n_accepted < cap THEN
    UPDATE public.trainer_live_session_invites
    SET status = 'accepted', responded_at = now(), updated_at = now()
    WHERE id = p_invite_id AND invitee_user_id = v_uid AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'accepted');
  ELSIF n_wait < wait_cap THEN
    UPDATE public.trainer_live_session_invites
    SET status = 'waitlisted', responded_at = now(), updated_at = now()
    WHERE id = p_invite_id AND invitee_user_id = v_uid AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'waitlisted');
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Session and waitlist are full');
  END IF;
END;
$$;
