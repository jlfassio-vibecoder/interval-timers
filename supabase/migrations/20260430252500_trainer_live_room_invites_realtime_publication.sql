-- Publish trainer_live_room_invites so clients on Account (and similar) receive pending-invite
-- updates via Supabase Realtime without a full page reload.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_live_room_invites;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

ALTER TABLE public.trainer_live_room_invites REPLICA IDENTITY FULL;
