-- Hourly sweep: close "zombie" trainer live sessions left active after the host closes the browser
-- without calling trainer_live_end_session. Uses direct UPDATE (cron runs with privileges that bypass RLS);
-- do not invoke trainer_live_end_session from cron (that RPC requires auth.uid() as the session trainer).
--
-- Schema reference: public.trainer_live_sessions has status IN ('active', 'ended'), ended_at timestamptz,
-- created_at timestamptz (see 20260430113000_trainer_live_video.sql). Terminal status matches
-- trainer_live_end_session: 'ended', not 'completed'.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent schedule: drop same-named job if present (e.g. migration re-run after local reset).
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-stale-live-sessions';

SELECT cron.schedule(
  'cleanup-stale-live-sessions',
  '0 * * * *',
  $$
  UPDATE public.trainer_live_sessions
  SET status = 'ended',
      ended_at = now()
  WHERE status = 'active'
    AND created_at < now() - interval '4 hours';
  $$
);

-- Rollback / manual down (uncomment and run if removing this job):
-- SELECT cron.unschedule('cleanup-stale-live-sessions');
-- Or: SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-stale-live-sessions';
