-- Production-ready access to shared.amrap_session_results without exposing the shared schema.
-- PostgREST only serves the public schema by default on hosted Supabase. Instead of requiring
-- Dashboard "Exposed schemas" config, we provide a public RPC that reads from shared and
-- respects RLS (SECURITY INVOKER = runs as caller, so auth.uid() is set and RLS applies).

CREATE OR REPLACE FUNCTION public.get_amrap_session_results(p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  total_rounds int,
  workout_list jsonb,
  duration_minutes int,
  completed_at timestamptz,
  round_durations int[],
  workout_name text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, shared
AS $$
  SELECT
    r.id,
    r.session_id,
    r.total_rounds,
    r.workout_list,
    r.duration_minutes,
    r.completed_at,
    COALESCE(r.round_durations, '{}'),
    r.workout_name
  FROM shared.amrap_session_results r
  WHERE r.user_id = auth.uid()
  ORDER BY r.completed_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

COMMENT ON FUNCTION public.get_amrap_session_results(int) IS
  'Returns AMRAP session results for the current user (HUD HistoryZone). Uses shared.amrap_session_results; RLS enforces auth.uid() = user_id.';

REVOKE EXECUTE ON FUNCTION public.get_amrap_session_results(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_amrap_session_results(int) TO authenticated;
