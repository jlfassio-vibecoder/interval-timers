-- Fix PostgREST 500 on SELECT trainer_live_participants: the peer policy from
-- 20260430116000 used EXISTS (SELECT … FROM trainer_live_participants me …),
-- which re-enters RLS on the same table and triggers infinite recursion.
-- 202604302329 fixed the trainer policy via SECURITY DEFINER; align the peer policy
-- with public.trainer_live_is_session_participant_user (same semantics, no recursion).

DROP POLICY IF EXISTS trainer_live_participants_select_peer ON public.trainer_live_participants;

CREATE POLICY trainer_live_participants_select_peer
  ON public.trainer_live_participants FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_session_participant_user(trainer_live_participants.session_id)
  );
