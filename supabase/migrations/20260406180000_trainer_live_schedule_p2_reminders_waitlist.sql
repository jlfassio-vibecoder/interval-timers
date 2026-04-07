-- P2: Reminder tracking on occurrences; decline from accepted + FIFO waitlist promotion.

ALTER TABLE public.trainer_live_session_occurrences
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz NULL;

COMMENT ON COLUMN public.trainer_live_session_occurrences.reminder_24h_sent_at IS
  'P2: set when ~24h-before-start reminder was sent (idempotent cron).';
COMMENT ON COLUMN public.trainer_live_session_occurrences.reminder_1h_sent_at IS
  'P2: set when ~1h-before-start reminder was sent (idempotent cron).';

-- Decline from pending, waitlisted, or accepted; promote one waitlisted if accepted freed a seat.
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
  v_occ uuid;
  v_promote_id uuid;
  n_acc int;
  cap int := 6;
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
    RETURN jsonb_build_object('ok', false, 'error', 'Complete roster invite signup before declining');
  END IF;

  IF v_invitee IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF v_status NOT IN ('pending', 'waitlisted', 'accepted') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot decline this invite');
  END IF;

  UPDATE public.trainer_live_session_invites
  SET status = 'declined', responded_at = now(), updated_at = now()
  WHERE id = p_invite_id AND invitee_user_id = v_uid;

  IF v_status = 'accepted' THEN
    PERFORM 1 FROM public.trainer_live_session_occurrences WHERE id = v_occ FOR UPDATE;

    SELECT count(*)::int INTO n_acc
    FROM public.trainer_live_session_invites
    WHERE occurrence_id = v_occ AND status = 'accepted';

    IF n_acc < cap THEN
      SELECT id INTO v_promote_id
      FROM public.trainer_live_session_invites
      WHERE occurrence_id = v_occ AND status = 'waitlisted'
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF v_promote_id IS NOT NULL THEN
        UPDATE public.trainer_live_session_invites
        SET status = 'accepted', responded_at = now(), updated_at = now()
        WHERE id = v_promote_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'declined');
END;
$$;
