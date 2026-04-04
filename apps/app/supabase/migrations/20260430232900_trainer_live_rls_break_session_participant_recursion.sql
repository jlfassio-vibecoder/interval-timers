-- Break infinite RLS recursion between trainer_live_sessions and trainer_live_participants:
-- session SELECT policy used EXISTS(participants); participant SELECT policy used EXISTS(sessions).
-- SECURITY DEFINER helpers read those tables with owner privileges (RLS bypass).
-- Also align tabata_sessions + activity timer policies that duplicated the same pattern.

CREATE OR REPLACE FUNCTION public.trainer_live_is_session_trainer(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trainer_live_sessions s
    WHERE s.id = p_session_id
      AND s.trainer_user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_is_session_participant_user(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trainer_live_participants p
    WHERE p.session_id = p_session_id
      AND p.user_id IS NOT NULL
      AND p.user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_is_activity_session_for_trainer(p_activity_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trainer_live_activity_sessions a
    INNER JOIN public.trainer_live_sessions s ON s.id = a.trainer_live_session_id
    WHERE a.id = p_activity_session_id
      AND s.trainer_user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.trainer_live_is_activity_segment_visible_to_participant(p_activity_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trainer_live_activity_sessions a
    INNER JOIN public.trainer_live_participants p ON p.session_id = a.trainer_live_session_id
    WHERE a.id = p_activity_session_id
      AND p.user_id IS NOT NULL
      AND p.user_id = (SELECT auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_is_session_trainer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_is_session_participant_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_is_activity_session_for_trainer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_live_is_activity_segment_visible_to_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS trainer_live_sessions_select_participant ON public.trainer_live_sessions;
CREATE POLICY trainer_live_sessions_select_participant
  ON public.trainer_live_sessions FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND public.trainer_live_is_session_participant_user(trainer_live_sessions.id)
  );

DROP POLICY IF EXISTS trainer_live_participants_select_trainer ON public.trainer_live_participants;
CREATE POLICY trainer_live_participants_select_trainer
  ON public.trainer_live_participants FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_session_trainer(trainer_live_participants.session_id)
  );

DROP POLICY IF EXISTS tabata_sessions_select_trainer ON public.tabata_sessions;
DROP POLICY IF EXISTS tabata_sessions_select_participant ON public.tabata_sessions;

CREATE POLICY tabata_sessions_select_trainer
  ON public.tabata_sessions FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_session_trainer(tabata_sessions.trainer_live_session_id)
  );

CREATE POLICY tabata_sessions_select_participant
  ON public.tabata_sessions FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_session_participant_user(tabata_sessions.trainer_live_session_id)
  );

DROP POLICY IF EXISTS trainer_live_activity_sessions_select_trainer ON public.trainer_live_activity_sessions;
DROP POLICY IF EXISTS trainer_live_activity_segments_select_trainer ON public.trainer_live_activity_segments;
DROP POLICY IF EXISTS trainer_live_activity_sessions_select_participant ON public.trainer_live_activity_sessions;
DROP POLICY IF EXISTS trainer_live_activity_segments_select_participant ON public.trainer_live_activity_segments;

CREATE POLICY trainer_live_activity_sessions_select_trainer
  ON public.trainer_live_activity_sessions FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_session_trainer(trainer_live_activity_sessions.trainer_live_session_id)
  );

CREATE POLICY trainer_live_activity_segments_select_trainer
  ON public.trainer_live_activity_segments FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_activity_session_for_trainer(trainer_live_activity_segments.activity_session_id)
  );

CREATE POLICY trainer_live_activity_sessions_select_participant
  ON public.trainer_live_activity_sessions FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_session_participant_user(trainer_live_activity_sessions.trainer_live_session_id)
  );

CREATE POLICY trainer_live_activity_segments_select_participant
  ON public.trainer_live_activity_segments FOR SELECT TO authenticated
  USING (
    public.trainer_live_is_activity_segment_visible_to_participant(trainer_live_activity_segments.activity_session_id)
  );
