-- Trainer Live T4: publish trainer_live_sessions to Supabase Realtime so host/clients receive
-- interval_wrapper_kind / interval_wrapper_config (e.g. tabata) without reload.
-- See docs/TRAINER_LIVE_TABATA_WRAPPER_TDD.md

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_live_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

ALTER TABLE public.trainer_live_sessions REPLICA IDENTITY FULL;
