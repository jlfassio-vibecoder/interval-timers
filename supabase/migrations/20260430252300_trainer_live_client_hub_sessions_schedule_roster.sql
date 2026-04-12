-- Hub list: add paths the UI already uses elsewhere but the hub RPC skipped:
-- 1) Unified calendar scheduled live: occurrence.live_session_id + session_invites.invitee_user_id
-- 2) Open (non–1:1-reserved) active rooms for any client with a non-revoked coach assignment to that trainer

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

      UNION ALL

      SELECT s.id,
             s.trainer_user_id,
             s.created_at,
             3 AS src_prio
      FROM public.trainer_live_sessions s
      INNER JOIN public.trainer_live_session_occurrences o
        ON o.live_session_id = s.id
       AND o.status IS DISTINCT FROM 'cancelled'
      INNER JOIN public.trainer_live_session_invites i
        ON i.occurrence_id = o.id
       AND i.invitee_user_id = (SELECT auth.uid())
       AND i.status IN ('pending', 'accepted', 'waitlisted')
      WHERE s.status = 'active'

      UNION ALL

      SELECT s.id,
             s.trainer_user_id,
             s.created_at,
             4 AS src_prio
      FROM public.trainer_live_sessions s
      WHERE s.status = 'active'
        AND s.invited_client_user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.client_coach_assignments a
          WHERE a.trainer_user_id = s.trainer_user_id
            AND a.client_user_id = (SELECT auth.uid())
            AND a.revoked_at IS NULL
        )
    ) cand
    LEFT JOIN public.profiles p ON p.id = cand.tid
    LEFT JOIN public.trainers t ON t.user_id = cand.tid
    ORDER BY cand.sid, cand.src_prio ASC, cand.cre DESC
  ) sub
  ORDER BY sub.session_created_at DESC;
$$;
