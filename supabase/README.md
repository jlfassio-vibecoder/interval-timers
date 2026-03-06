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

## Verification

Use `supabase/verify_amrap_migrations.sql` in the SQL Editor to confirm RPCs, constraints, and RLS. After applying the schema migration, you should see schemas `amrap` and `shared` in the project.
