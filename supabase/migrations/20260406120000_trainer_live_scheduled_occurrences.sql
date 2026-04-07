-- P0: Scheduled live session occurrences + invites (roster clients only).
-- Design: docs/trainer-unified-calendar-live-session-scheduling-design.md

CREATE TABLE public.trainer_live_session_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  series_id uuid NULL,
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  live_session_id uuid NULL REFERENCES public.trainer_live_sessions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tls_occ_end_after_start CHECK (scheduled_end_at > scheduled_start_at)
);

CREATE INDEX idx_tls_occ_trainer_scheduled
  ON public.trainer_live_session_occurrences (trainer_user_id, scheduled_start_at);

COMMENT ON TABLE public.trainer_live_session_occurrences IS
  'Planned live session time windows; P0 single occurrence, series_id reserved for P1 recurrence.';

CREATE TABLE public.trainer_live_session_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.trainer_live_session_occurrences (id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'declined', 'waitlisted', 'expired', 'cancelled')
  ),
  roster_invitation_id uuid NULL REFERENCES public.roster_invitations (id) ON DELETE SET NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occurrence_id, invitee_user_id)
);

CREATE INDEX idx_tls_inv_invitee ON public.trainer_live_session_invites (invitee_user_id);
CREATE INDEX idx_tls_inv_occurrence ON public.trainer_live_session_invites (occurrence_id);

COMMENT ON TABLE public.trainer_live_session_invites IS
  'Per-invitee acceptance for a scheduled occurrence; capacity 6 + waitlist ceil(20%*6)=2 in accept RPC.';

ALTER TABLE public.trainer_live_session_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_live_session_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY tls_occ_select_trainer_mc
  ON public.trainer_live_session_occurrences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_user_id AND public.is_mission_control_staff());

CREATE POLICY tls_occ_select_invitee
  ON public.trainer_live_session_occurrences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_live_session_invites i
      WHERE i.occurrence_id = trainer_live_session_occurrences.id
        AND i.invitee_user_id = auth.uid()
    )
  );

CREATE POLICY tls_inv_select_invitee
  ON public.trainer_live_session_invites
  FOR SELECT
  TO authenticated
  USING (invitee_user_id = auth.uid());

CREATE POLICY tls_inv_select_trainer_mc
  ON public.trainer_live_session_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_live_session_occurrences o
      WHERE o.id = trainer_live_session_invites.occurrence_id
        AND o.trainer_user_id = auth.uid()
        AND public.is_mission_control_staff()
    )
  );

-- Accept: capacity 6, waitlist max 2 (20% of 6, ceiling).
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

  IF v_invitee IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
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

CREATE OR REPLACE FUNCTION public.trainer_live_schedule_invite_decline(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_invitee uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT status, invitee_user_id INTO v_status, v_invitee
  FROM public.trainer_live_session_invites
  WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invite not found');
  END IF;

  IF v_invitee IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF v_status NOT IN ('pending', 'waitlisted') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot decline this invite');
  END IF;

  UPDATE public.trainer_live_session_invites
  SET status = 'declined', responded_at = now(), updated_at = now()
  WHERE id = p_invite_id AND invitee_user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'status', 'declined');
END;
$$;

REVOKE ALL ON FUNCTION public.trainer_live_schedule_invite_accept(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_live_schedule_invite_accept(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.trainer_live_schedule_invite_decline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_live_schedule_invite_decline(uuid) TO authenticated;
