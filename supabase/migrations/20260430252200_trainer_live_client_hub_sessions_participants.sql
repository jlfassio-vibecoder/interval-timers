-- Hub list: include active sessions the signed-in user has joined as a client (open link / rejoin),
-- not only invited-client or calendar-linked rows.
--
-- Copilot suggestion ignored: Same RPC is extended again in 523; do not merge migrations post hoc.

CREATE OR REPLACE FUNCTION public.trainer_live_client_hub_sessions()
RETURNS TABLE (
  session_id uuid,
  trainer_display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT sub.session_id,
         sub.trainer_display_name
  FROM (
    SELECT DISTINCT ON (cand.sid)
      cand.sid AS session_id,
      COALESCE(
        NULLIF(trim(t.display_name), ''),
        NULLIF(trim(p.full_name), ''),
        NULLIF(trim(p.username), ''),
        'Trainer'
      ) AS trainer_display_name,
      cand.cre AS session_created_at
    FROM (
      SELECT s.id AS sid,
             s.trainer_user_id AS tid,
             s.created_at AS cre,
             0 AS src_prio
      FROM public.trainer_live_sessions s
      WHERE s.status = 'active'
        AND s.invited_client_user_id = (SELECT auth.uid())

      UNION ALL

      SELECT s.id,
             s.trainer_user_id,
             s.created_at,
             1 AS src_prio
      FROM public.client_coach_schedule_instances c
      INNER JOIN public.trainer_live_sessions s
        ON s.id = c.trainer_live_session_id
       AND s.status = 'active'
      WHERE c.client_user_id = (SELECT auth.uid())
        AND c.trainer_live_session_id IS NOT NULL

      UNION ALL

      SELECT s.id,
             s.trainer_user_id,
             s.created_at,
             2 AS src_prio
      FROM public.trainer_live_sessions s
      INNER JOIN public.trainer_live_participants part
        ON part.session_id = s.id
       AND part.role = 'client'
       AND part.user_id = (SELECT auth.uid())
      WHERE s.status = 'active'
    ) cand
    LEFT JOIN public.profiles p ON p.id = cand.tid
    LEFT JOIN public.trainers t ON t.user_id = cand.tid
    ORDER BY cand.sid, cand.src_prio ASC, cand.cre DESC
  ) sub
  ORDER BY sub.session_created_at DESC;
$$;
