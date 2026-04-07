-- P1: Recurring series, nullable prospect invites, roster-accept bind trigger.

-- ---------------------------------------------------------------------------
-- Series (weekly MVP)
-- ---------------------------------------------------------------------------
CREATE TABLE public.trainer_live_session_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency = 'weekly'),
  interval_weeks int NOT NULL DEFAULT 1 CHECK (interval_weeks >= 1),
  -- 0 = Sunday .. 6 = Saturday (JavaScript Date.getDay())
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  iana_timezone text NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  local_start_time time NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  expand_horizon_weeks int NOT NULL DEFAULT 12 CHECK (expand_horizon_weeks >= 1 AND expand_horizon_weeks <= 104),
  until_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tls_series_trainer ON public.trainer_live_session_series (trainer_user_id);

COMMENT ON TABLE public.trainer_live_session_series IS
  'P1 weekly recurrence metadata; occurrences are materialized rows.';

-- FK from occurrences to series (nullable for one-offs)
ALTER TABLE public.trainer_live_session_occurrences
  ADD CONSTRAINT trainer_live_session_occurrences_series_id_fkey
  FOREIGN KEY (series_id) REFERENCES public.trainer_live_session_series (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tls_occ_series ON public.trainer_live_session_occurrences (series_id)
  WHERE series_id IS NOT NULL;

ALTER TABLE public.trainer_live_session_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY tls_series_select_trainer_mc
  ON public.trainer_live_session_series
  FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_user_id AND public.is_mission_control_staff());

-- ---------------------------------------------------------------------------
-- Invites: prospect rows (NULL invitee until roster accept binds user)
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainer_live_session_invites
  DROP CONSTRAINT IF EXISTS trainer_live_session_invites_occurrence_id_invitee_user_id_key;

ALTER TABLE public.trainer_live_session_invites
  DROP CONSTRAINT IF EXISTS trainer_live_session_invites_invitee_user_id_fkey;

ALTER TABLE public.trainer_live_session_invites
  ALTER COLUMN invitee_user_id DROP NOT NULL;

ALTER TABLE public.trainer_live_session_invites
  ADD CONSTRAINT trainer_live_session_invites_invitee_user_id_fkey
  FOREIGN KEY (invitee_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.trainer_live_session_invites
  ADD CONSTRAINT trainer_live_session_invites_bound_chk CHECK (
    invitee_user_id IS NOT NULL
    OR roster_invitation_id IS NOT NULL
  );

CREATE UNIQUE INDEX tls_inv_unique_occ_user
  ON public.trainer_live_session_invites (occurrence_id, invitee_user_id)
  WHERE invitee_user_id IS NOT NULL;

CREATE UNIQUE INDEX tls_inv_unique_occ_roster
  ON public.trainer_live_session_invites (occurrence_id, roster_invitation_id)
  WHERE roster_invitation_id IS NOT NULL;

-- Refresh accept RPC: unbound prospect invites cannot accept
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

  IF v_invitee IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Complete roster invite signup before declining');
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

-- When a roster invitation is accepted, bind pending live invites that reference it.
CREATE OR REPLACE FUNCTION public.trg_tls_bind_live_invites_on_roster_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'accepted'
     AND NEW.accepted_user_id IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.accepted_user_id IS DISTINCT FROM NEW.accepted_user_id
     )
  THEN
    UPDATE public.trainer_live_session_invites li
    SET
      invitee_user_id = NEW.accepted_user_id,
      updated_at = now()
    FROM public.trainer_live_session_occurrences o
    WHERE li.roster_invitation_id = NEW.id
      AND li.occurrence_id = o.id
      AND o.trainer_user_id = NEW.inviter_id
      AND li.invitee_user_id IS NULL
      AND li.status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tls_roster_accept_bind_live ON public.roster_invitations;
CREATE TRIGGER trg_tls_roster_accept_bind_live
  AFTER UPDATE ON public.roster_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tls_bind_live_invites_on_roster_accept();
