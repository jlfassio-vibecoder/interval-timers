-- Hide host_token from client reads; allow round inserts only via log_round RPC.
-- App uses no auth (participant_id in sessionStorage), so we do not use auth.uid().

-- 1. amrap_sessions: allow anon/authenticated to read only non-sensitive columns (not host_token).
REVOKE ALL ON amrap_sessions FROM anon, authenticated;
GRANT SELECT (id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at)
  ON amrap_sessions TO anon, authenticated;
-- INSERT still needed for create_session RPC (runs as definer, so not affected by anon revoke).
-- Postgres/superuser and service role retain full access; anon cannot read host_token.

-- 2. amrap_rounds: remove permissive INSERT so clients cannot insert directly (only log_round RPC can).
DROP POLICY IF EXISTS "amrap_rounds_insert" ON amrap_rounds;
-- RPC log_round (SECURITY DEFINER) performs the insert with definer privileges, so rounds are only created via RPC.
