-- Trainer Live: tighten RLS (Copilot PR #134). Runs after P2 (`20260430115000`).
-- Version 20260430116000: unique timestamp — 20260403120000 is already used by
-- `20260403120000_client_training_preferences_rls.sql` (schema_migrations.version is one row per timestamp).

-- Anon must not read session/participant rows
-- (leaked trainer_user_id, invited_client_user_id, user_id). Use SECURITY DEFINER RPCs for
-- token verification and in-room display names.

-- Token route: single check without exposing table columns over permissive RLS.
CREATE OR REPLACE FUNCTION public.trainer_live_verify_token_targets(
  p_session_id uuid,
  p_participant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trainer_live_participants p
    INNER JOIN public.trainer_live_sessions s ON s.id = p.session_id
    WHERE p.session_id = p_session_id
      AND p.id = p_participant_id
      AND s.status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_verify_token_targets(uuid, uuid) TO anon, authenticated;

-- In-room labels: id, role, display_name only (active sessions). Holder of session UUID can call;
-- same trust model as the join link.
CREATE OR REPLACE FUNCTION public.trainer_live_list_participants(p_session_id uuid)
RETURNS TABLE (
  id uuid,
  role text,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id, p.role, p.display_name
  FROM public.trainer_live_participants p
  INNER JOIN public.trainer_live_sessions s ON s.id = p.session_id
  WHERE p.session_id = p_session_id
    AND s.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.trainer_live_list_participants(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS trainer_live_sessions_select_active ON public.trainer_live_sessions;
DROP POLICY IF EXISTS trainer_live_participants_select ON public.trainer_live_participants;

-- Trainer: all participants in their sessions.
CREATE POLICY trainer_live_participants_select_trainer
  ON public.trainer_live_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_live_sessions s
      WHERE s.id = trainer_live_participants.session_id
        AND s.trainer_user_id = (SELECT auth.uid())
    )
  );

-- Signed-in participants (user_id set): read peers in the same session (display names for tiles).
CREATE POLICY trainer_live_participants_select_peer
  ON public.trainer_live_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_live_participants me
      WHERE me.session_id = trainer_live_participants.session_id
        AND me.user_id IS NOT NULL
        AND me.user_id = (SELECT auth.uid())
    )
  );

REVOKE SELECT ON public.trainer_live_sessions FROM anon;
REVOKE SELECT ON public.trainer_live_participants FROM anon;
