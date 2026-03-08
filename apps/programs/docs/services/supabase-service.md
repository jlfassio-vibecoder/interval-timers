# Supabase Service

## Overview

Supabase is the sole backend for AI Fit Copilot: auth, profiles, programs, workouts, challenges, equipment, exercises, generated exercises, exercise gallery, warmup config, workout logs, and server-side admin (auth, equipment, warmup, storage upload).

## Configuration

- `PUBLIC_SUPABASE_URL` – Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` – Supabase anon (public) key
- `SUPABASE_SERVICE_ROLE_KEY` – Optional; used for server-side admin (e.g. warmup API, storage) when RLS must be bypassed

Validation: `npm run check-env` requires `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.

## Key modules

- **Auth:** `src/lib/supabase/admin/auth.ts` – `verifyAdminRequest`, `getCurrentUserFromRequest`, `extractAccessToken`
- **Client:** `src/lib/supabase/client.ts` – browser Supabase client
- **Server:** `src/lib/supabase/server.ts` – `getSupabaseServer()` for service-role server client
- **Profiles:** `src/lib/supabase/client/profiles.ts` – `updatePurchasedPass`
- **Programs / Workouts:** `src/lib/supabase/admin/programs.ts`, `src/lib/supabase/admin/workouts.ts`, `src/lib/supabase/admin/workout-details.ts`
- **Equipment / Exercises:** `src/lib/supabase/client/equipment.ts`, `src/lib/supabase/client/exercises.ts`
- **Generated exercises / Gallery:** `src/lib/supabase/client/generated-exercises.ts`, `src/lib/supabase/client/exercise-gallery.ts`
- **Warmup:** `src/lib/supabase/client/warmup-config.ts`, `src/lib/supabase/admin/warmup-config.ts`
- **Tracking / Logs:** `src/lib/supabase/client/tracking.ts`, `src/lib/supabase/client/workout-logs.ts`
- **User programs:** `src/lib/supabase/client/user-programs.ts`
- **Storage:** `src/lib/supabase/admin/storage-upload.ts` – `uploadBufferToStorage` (Supabase Storage)

## Schema

Schema is defined in `supabase/migrations/00001_initial_schema.sql`. Run it in the Supabase SQL editor or via `supabase db push` if using the Supabase CLI.

## Session cookie

Admin and server routes use the `sb-access-token` cookie (set by `src/lib/auth-cookie.ts`) so the server can verify the Supabase session via `extractAccessToken` / `verifyAdminRequest`.
