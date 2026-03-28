# Supabase — HIIT Workout Timers monorepo

One project (`dgxoyhkqdxarewmanbrq`). Partition by **schema** and **table prefix** so each app stays scoped and shared data has a clear place.

## Schema layout

| Layer        | Use |
|-------------|-----|
| **public**  | Current app tables with prefix (e.g. `amrap_sessions`, `amrap_participants`, `amrap_rounds`). No change to existing apps. |
| **amrap**   | Optional future home for AMRAP-specific objects. New tables/views can go here; RPCs would set `search_path = public, amrap` or qualify names. |
| **shared**  | Cross-app data (e.g. `shared.user_saved_timers`, `shared.profiles`) when auth or shared features are added. |

- **New app:** Create a schema with the app name (e.g. `tabata`) and put that app’s tables there, or keep using `public` with a strong table prefix (e.g. `tabata_*`).
- **Cross-app:** Use the `shared` schema and a small set of tables (e.g. user identity, saved timer configs).

## Migrations

Run from repo root with env loaded:

```bash
export $(grep -v '^#' .env | xargs)
supabase migration list
# Apply pending: psql "$DATABASE_URL" -f supabase/migrations/<name>.sql
```

**Order (oldest first):**

1. `20250305000000_amrap_with_friends.sql` — Tables, RPCs, RLS for AMRAP With Friends
2. `20250305100000_amrap_realtime_participants.sql` — Realtime for participants
3. `20250305200000_amrap_require_nicknames.sql` — Nicknames, join lock, create_session signature
4. `20250305300000_amrap_log_round_rpc.sql` — log_round RPC, unique constraint on rounds
5. `20250305400000_amrap_rls_tighten.sql` — Column grants (no host_token), drop rounds INSERT policy
6. `20250305500000_schemas_amrap_shared.sql` — Create `amrap` and `shared` schemas and grants
7. `20250305600000_amrap_session_messages.sql` — Session message board table and Realtime
8. `20250305700000_amrap_rounds_realtime.sql` — Realtime for amrap_rounds
9. `20250305800000_amrap_scheduled_start.sql` — scheduled_start_at and create_session overload

Later migrations add analytics tables/RPCs (e.g. `web_events`, `get_acquisition_stats`, `get_retention_cohort_stats`, `get_monetization_funnel_stats`, `get_minimal_onboarding_dropoff`, `stripe_processed_webhook_events`, `profile_billing_snapshot`) and `COMMENT ON COLUMN profiles.purchased_index` for tier semantics (0–5). For admin metric definitions, see **`docs/ADMIN_ANALYTICS.md`**.

## AMRAP session results (HUD)

The app loads AMRAP results via **public.get_amrap_session_results(p_limit)** RPC (migration `20250319100000_expose_shared_schema.sql`). The RPC reads from `shared.amrap_session_results` with `auth.uid()`, so the `shared` schema does not need to be exposed in PostgREST. No Dashboard config required.

**If you already applied an earlier version of this migration** (e.g. the no-op one): run the full contents of `20250319100000_expose_shared_schema.sql` in the Supabase SQL Editor to create or replace the RPC.

## Workout logs readiness (HUD Today Zone)

The HUD Today Zone includes a Readiness Check-In (1–5) stored in `public.workout_logs`. Migration `20250319200000_workout_logs_readiness.sql` adds the `readiness_score` column if missing. Apply it so the readiness query does not return 400.

## Verification

Use `supabase/verify_amrap_migrations.sql` in the SQL Editor to confirm RPCs, constraints, and RLS. After applying the schema migration, you should see schemas `amrap` and `shared` in the project.

## Resetting the database (e.g. after wrong schema from another project)

If the database was changed by another project or you want to start over:

1. **Run the reset script** in Supabase Dashboard → SQL Editor (or via `psql`):
   - Open `supabase/reset_database.sql` and run it. This drops only this repo’s objects (amrap_* tables, RPCs, `amrap` and `shared` schemas).

2. **Drop any other project’s schemas** (optional):  
   In SQL Editor, list non-system schemas:
   ```sql
   SELECT nspname FROM pg_catalog.pg_namespace
   WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema');
   ```
   Then for each unwanted schema: `DROP SCHEMA IF EXISTS schema_name CASCADE;`  
   If the other project added tables in `public`, drop those manually (e.g. `DROP TABLE other_table CASCADE;`).

3. **Re-apply this repo’s migrations** in order (see Migrations list above), e.g. by running each `supabase/migrations/*.sql` file in order via SQL Editor or `psql`.

## Using the Supabase CLI

Use **`supabase login`** (browser); no access token in `.env` needed.

1. **Log in and link** (from repo root):
   ```bash
   supabase login
   export $(grep -v '^#' .env | xargs)
   supabase link --project-ref dgxoyhkqdxarewmanbrq --password "$SUPABASE_DB_PASSWORD"
   ```
   Use the **account that owns** project `dgxoyhkqdxarewmanbrq`. If you get `Unauthorized`, run `supabase logout` then `supabase login` again with that account.

2. After a successful link, use `supabase db push`, `supabase db pull`, `supabase migration list`, etc. as needed.

**If migration history doesn’t match local files:**  
Run `supabase/repair_migration_history.sql` (e.g. `psql "$DATABASE_URL" -f supabase/repair_migration_history.sql` with `.env` loaded, or paste into Dashboard → SQL Editor).
