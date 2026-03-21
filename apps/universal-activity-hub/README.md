# Universal Activity Hub

Standalone Vite + React + Tailwind app: paste unstructured workout text, AI parses it into a **`WorkoutSetTemplate`** (JSON shape is defined in [`@interval-timers/workout-contract`](../../packages/workout-contract); the hub re-exports via [`src/types/workoutSetTemplate.ts`](./src/types/workoutSetTemplate.ts)), then schedule, log, or save to Training Log.

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

### Open Workout / Save Workout

**Open Workout** and **Save Workout** both send the parsed workout via `/api/workout-handoff`. The user logs sets, reps, and weights in the gym-style WorkoutPlayer, then saves to Training Log. Requires main app on port 3006 (or `VITE_APP_ORIGIN` / `VITE_MAIN_APP_ORIGIN`) and user signed in.

### Schedule

**Schedule** opens a date/time picker, POSTs to the main app’s `/api/schedule-workout-handoff`, then opens the main app to confirm and save to your calendar. Requires main app dev server and user signed in.

### Log Past

**Log Past** POSTs to `/api/quick-log-workout-handoff`, opens `/workout/log-past-summary` for a quick summary form (date, effort, rating, notes), and saves to `workout_logs` with `source: 'universal_activity_hub'`.


## Test

```bash
npm run test -w universal-activity-hub
```
