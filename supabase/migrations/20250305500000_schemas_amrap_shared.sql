-- Schema layout for monorepo: one project, app and shared namespaces.
-- Existing amrap_* tables stay in public; new app-specific objects can live in amrap schema,
-- cross-app (e.g. user_saved_timers) in shared when needed.

-- App-specific schema (future: move or add amrap objects here; tables like amrap.sessions).
CREATE SCHEMA IF NOT EXISTS amrap;

-- Shared schema for cross-app data (e.g. user identity, saved timers) when we add auth.
CREATE SCHEMA IF NOT EXISTS shared;

-- Allow anon and authenticated to use these schemas (required for Supabase client and RLS).
GRANT USAGE ON SCHEMA amrap TO anon, authenticated;
GRANT USAGE ON SCHEMA shared TO anon, authenticated;

-- Service role keeps full access (default); explicit for clarity.
GRANT ALL ON SCHEMA amrap TO service_role;
GRANT ALL ON SCHEMA shared TO service_role;

-- Default: new tables in these schemas get SELECT for anon/authenticated only until RLS/grants are set per table.
-- No CREATE on schema for anon/authenticated; migrations run as postgres/superuser.
