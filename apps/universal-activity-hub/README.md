# Universal Activity Hub

Standalone Vite + React + Tailwind app: paste unstructured workout text, AI parses it into a [`WorkoutSetTemplate`](./src/types/workoutSetTemplate.ts) (same shape as the main app’s workouts), then (later) schedule, log, or launch timers.

## Develop

**Prerequisites:** The main app must run on **port 3006** for the parse API. From repo root:

```bash
npm run dev -w app          # Start app on :3006
npm run dev:universal-activity-hub   # Start hub on :5180
```

The hub proxies `/api` to the app during local dev (see `vite.config.ts`). Hub serves at **http://localhost:5180**.

### Environment

- Copy [`.env.example`](./.env.example) to **`.env.local`** and align values with `apps/app/.env.local` (same Supabase project).
- **`VITE_APP_ORIGIN`:** omit in local dev so `fetch('/api/...')` uses the proxy; set only when the hub must call a deployed app URL (production preview).
- **AI parse** still runs on the main app: set `GEMINI_API_KEY` or `GOOGLE_PROJECT_ID` in **`apps/app/.env.local`**, not here (avoid exposing server keys to the browser).

Or from this directory: `npm run dev`

## Training Log (source of truth for saved activity)

The main app’s **Training Log** (`apps/app`, `/training-log`) aggregates **`workout_logs`** and **`user_workout_logs`** (see [`docs/TRAINING_LOG_SOURCES.md`](../../docs/TRAINING_LOG_SOURCES.md)).

### Open Workout

**Open Workout** sends the parsed workout to the main app via a short-lived handoff. The user logs sets, reps, and weights in the gym-style WorkoutPlayer, then saves to Training Log. Requires:

- Main app running on port 3006 (or set `VITE_APP_ORIGIN` / `VITE_MAIN_APP_ORIGIN` in hub `.env.local` for production).
- User signed in on the main app (opens in new tab; sign-in prompted if needed).

### Schedule

**Schedule** opens a date/time picker, POSTs the workout and chosen time to the main app’s `/api/schedule-workout-handoff`, then opens the main app in a new tab to confirm and save to your calendar. Requires the main app dev server (API proxy). User must be signed in on the main app to persist.

### Other actions

**Log Past** and **Launch Timer** are placeholders (not yet wired). Future: wire to summary log and timers.


## Test

```bash
npm run test -w universal-activity-hub
```
