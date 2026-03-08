-- Mark all interval-timers migrations as applied in the remote DB.
-- Use when: "The remote database's migration history does not match local files"
-- and you've applied the migrations manually or via Dashboard. Run with:
--   psql "$DATABASE_URL" -f supabase/repair_migration_history.sql
-- or paste into Supabase Dashboard → SQL Editor.
--
-- Requires table supabase_migrations.schema_migrations (version, name).

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20250305000000', '20250305000000_amrap_with_friends'),
  ('20250305100000', '20250305100000_amrap_realtime_participants'),
  ('20250305200000', '20250305200000_amrap_require_nicknames'),
  ('20250305300000', '20250305300000_amrap_log_round_rpc'),
  ('20250305400000', '20250305400000_amrap_rls_tighten'),
  ('20250305500000', '20250305500000_schemas_amrap_shared'),
  ('20250305600000', '20250305600000_amrap_session_messages'),
  ('20250305700000', '20250305700000_amrap_rounds_realtime'),
  ('20250305800000', '20250305800000_amrap_scheduled_start')
ON CONFLICT (version) DO NOTHING;
