-- Reset database for interval-timers (AMRAP With Friends) so you can re-apply migrations from scratch.
-- Run this in Supabase SQL Editor (or psql) against your project, then run migrations 20250305000000 through 20250305800000 in order.
--
-- This removes ONLY objects created by this repo's migrations. If another project added schemas/tables,
-- run the "Drop other project's schemas" section below (edit schema names) or drop those objects manually.

BEGIN;

-- 1. Remove our tables from Realtime publication (avoids errors when dropping tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS amrap_session_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS amrap_rounds; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS amrap_participants; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS amrap_sessions; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 2. Drop tables (order: dependents first; CASCADE drops policies, indexes, constraints)
DROP TABLE IF EXISTS amrap_session_messages CASCADE;
DROP TABLE IF EXISTS amrap_rounds CASCADE;
DROP TABLE IF EXISTS amrap_participants CASCADE;
DROP TABLE IF EXISTS amrap_sessions CASCADE;

-- 3. Drop RPCs (all overloads)
DROP FUNCTION IF EXISTS log_round(uuid, uuid, int);
DROP FUNCTION IF EXISTS update_session_state(uuid, text, text, int, boolean, timestamptz);
DROP FUNCTION IF EXISTS join_session(uuid, text);
DROP FUNCTION IF EXISTS create_session(int, text, jsonb, timestamptz);
DROP FUNCTION IF EXISTS create_session(int, text, jsonb);
DROP FUNCTION IF EXISTS create_session(int, jsonb);

-- 4. Drop app schemas (created by 20250305500000_schemas_amrap_shared.sql)
DROP SCHEMA IF EXISTS amrap CASCADE;
DROP SCHEMA IF EXISTS shared CASCADE;

COMMIT;

-- =============================================================================
-- Optional: Remove schemas from the OTHER project (edit names as needed)
-- =============================================================================
-- List non-system schemas:
--   SELECT nspname FROM pg_catalog.pg_namespace
--   WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema');
--
-- Then for each unwanted schema:
--   DROP SCHEMA IF EXISTS other_schema_name CASCADE;
--
-- If the other project added tables in public (not amrap_*), drop those manually:
--   DROP TABLE IF EXISTS other_table CASCADE;
