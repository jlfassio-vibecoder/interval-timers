# Fixing Supabase Schema Mismatches

When the app expects columns or tables that don’t exist in your Supabase project, you’ll see errors like `column profiles.email does not exist` or `column profiles.purchased_index does not exist`. This usually happens when:

- The project was created with a minimal schema (e.g. Supabase Auth’s default `profiles`) and migrations weren’t run in order.
- Migrations in `supabase/migrations/` were never applied to this project.

Use one of the methods below to bring the database in line with the code. **Do not reset the database**; only add or change what’s missing.

---

## Option 1: Supabase MCP (recommended, no DB password)

If you use Cursor with the **Supabase MCP** and have a Supabase access token configured:

1. Open the migration file (e.g. `supabase/migrations/00060_profiles_sync_columns.sql`).
2. Ask the AI to apply it via the MCP: e.g. “Apply this migration to my Supabase project using the MCP.”
3. The MCP uses your access token; no database password is required.

This is the same flow used to fix `profiles` (email, purchased_index, etc.).

---

## Option 2: SQL Editor in the Dashboard

No CLI or DB password needed; uses your logged-in session.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Open **SQL Editor** → **New query**.
3. Paste the contents of the migration file (e.g. from `supabase/migrations/00060_profiles_sync_columns.sql`).
4. Run the query (Run or Cmd+Enter).

Good for one-off fixes and for applying any migration file by hand.

---

## Option 3: Supabase CLI (`supabase db push`)

Pushes all pending migrations from `supabase/migrations/` to the linked project.

**Requirements:**

- Project linked: `supabase link --project-ref YOUR_PROJECT_REF`
- Logged in: `supabase login` (or set `SUPABASE_ACCESS_TOKEN`)
- **Database password** set: Dashboard → **Settings** → **Database** → reset database password, then set `SUPABASE_DB_PASSWORD` in `.env.local` (or export it)

Then run:

```bash
npm run db:push
```

Or, with env loaded from `.env.local`:

```bash
supabase db push
```

If you don’t want to use a database password, use Option 1 or 2 instead.

---

## Sync migrations (add missing columns safely)

For tables that already exist but are missing columns (e.g. `profiles`), we use **sync migrations** that only add what’s missing:

- **`00059_add_profiles_email.sql`** – adds `profiles.email` if missing and backfills from `auth.users`.
- **`00060_profiles_sync_columns.sql`** – adds any missing `profiles` columns: `email`, `full_name`, `avatar_url`, `role`, `purchased_index`, `created_at`, `updated_at`.

These use `IF NOT EXISTS` (or equivalent checks) so they’re safe to run more than once.

**Adding a new sync migration:**

1. Create a new file under `supabase/migrations/` (e.g. `00061_sync_some_table.sql`).
2. Use a `DO $$ ... END $$` block and, for each column, check `information_schema.columns` and `ALTER TABLE ... ADD COLUMN` only if the column is missing.
3. Apply it with Option 1 or 2 above.

---

## Reference: expected `profiles` columns

The app expects `public.profiles` to have (see `supabase/migrations/00001_initial_schema.sql` and `src/lib/supabase/admin/statistics.ts`):

| Column            | Type        | Notes                              |
| ----------------- | ----------- | ---------------------------------- |
| `id`              | uuid        | PK, references `auth.users(id)`    |
| `email`           | text        | Often backfilled from auth.users   |
| `full_name`       | text        |                                    |
| `avatar_url`      | text        |                                    |
| `role`            | text        | `'client' \| 'trainer' \| 'admin'` |
| `purchased_index` | integer     |                                    |
| `created_at`      | timestamptz |                                    |
| `updated_at`      | timestamptz |                                    |

If you see “column profiles.X does not exist”, add `X` (and any other missing columns) via a sync migration, then apply it with Option 1 or 2.

---

## Storage bucket missing (400 on image URLs)

If image URLs like `.../storage/v1/object/exercise-images/...` return **400** or "bucket not found", the **exercise-images** storage bucket may not exist. The app uses this bucket for visualization lab and generated exercise images.

**Fix:** Apply the storage migration that creates the bucket and policies:

- **Migration:** `supabase/migrations/00061_storage_exercise_images_bucket.sql`
- Creates the `exercise-images` bucket (public) and RLS policies for authenticated upload/update/delete.
- Apply via [Option 1 (MCP)](#option-1-supabase-mcp-recommended-no-db-password) or [Option 2 (SQL Editor)](#option-2-sql-editor-in-the-dashboard).

After applying, new uploads will succeed. Old image URLs that failed because the bucket didn’t exist at upload time will still 400 (the object was never stored); re-generate or re-save those images.

---

## See also

- [Supabase Service](./services/supabase-service.md) – config and main modules
- `.env.example` (project root) – `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (optional for CLI)
