# Training Log: workout_logs.source Registry

Training Log aggregates sessions from **`workout_logs`** and **`user_workout_logs`**. This document records every `workout_logs.source` value: how rows are written, dedupe key shape, and any domain table.

## Sources

| source | Writer | Dedupe key shape | Domain table |
|--------|--------|------------------|--------------|
| `tabata` | Handoff (`log-handoff.ts`) | `sha256(userId\|intent\|source\|timestamp)` | — |
| `amrap` | Handoff (solo timer) | `sha256(userId\|intent\|source\|timestamp)` | — |
| `daily-warmup` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `emom` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `lactate-threshold` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `phosphagen` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `gibala` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `wingate` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `timmons` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `10-20-30` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `mindful` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `aerobic` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `bio-sync60` | Handoff | `sha256(userId\|intent\|source\|timestamp)` | — |
| `amrap_with_friends` | DB sync (`persist_amrap_session_results`) | `amrap_with_friends:{user_id}:{session_id}:{segment_index}` | `shared.amrap_session_results` |
| `amrap_with_friends_warmup` | DB sync (`persist_amrap_warmup_completion`) | `amrap_with_friends_warmup:{user_id}:{session_id}` | — |
| `amrap_with_friends_free` | DB sync (`persist_free_workout_completion`) | `amrap_with_friends_free:{user_id}:{session_id}:{epoch}` | — |
| `trainer_live` | `trainer_live_activity_finalize` RPC | `trainer_live:{user_id}:{activity_session_id}` | `trainer_live_activity_sessions`, `trainer_live_activity_segments` |
| `universal_activity_hub` | Hub Log Past (`PastedQuickLogPage` → `saveWorkoutLog`) | — | — |
| *(null)* | Manual / summary (`saveWorkoutLog`) | — | — |
| *(Readiness)* | `readiness.ts` (workout_name='Readiness') | — | — |

## Program sessions

Program completions come from **`user_workout_logs`**, not `workout_logs`. They are merged by `fetchWorkoutLogsForTraining` with `source: 'program'`. No dedupe key in workout_logs.

### Universal Activity Hub (pasted workouts)

Two flows:

1. **Open Workout / Save Workout** — Written to `user_workout_logs` with:
   - `program_id` = `universal_activity_hub`
   - `week_id` = `adhoc`
   - `workout_id` = unique per session
   - `workout_display_name` = workout title (e.g. from AI parse)

   Flow: hub → POST `/api/workout-handoff` → `window.open` `/workout/log-pasted?hid=...` → WorkoutPlayer → `saveWorkoutLog` (tracking client) with `workoutDisplayName`.

2. **Log Past** — Quick summary written to `workout_logs` with `source` = `universal_activity_hub`:
   - Flow: hub → POST `/api/quick-log-workout-handoff` → `window.open` `/workout/log-past-summary?hid=...` → `PastedQuickLogPage` → `saveWorkoutLog` (workout-logs client) with effort, rating, notes, date.

Program gym logs store `exercises` as JSON on `user_workout_logs`. Per-side prescriptions (e.g. `10/side`, “per side” in reps or name) log **`actualRepsLeft`** and **`actualRepsRight`** on each set plus **`actualReps`** (L+R) for totals; no DB migration—new keys live inside the existing `exercises` jsonb.

## Handoff flow

1. User completes timer in spoke app (Tabata, EMOM, etc.).
2. Spoke redirects to `/account?intent=save_session&source=<appId>&time=X&rounds=Y` (via `buildAccountRedirectUrl`).
3. User signs up/logs in on account page.
4. `AccountLanding` calls `logHandoffSession(handoff, uid)`.
5. `log-handoff.ts` inserts into `workout_logs` if `source` is in `ALLOWED_SOURCES`.

### Trainer Live (parent session + AMRAP blocks)

- **Parent row** (`source = trainer_live`): total elapsed active time for the live activity timer (pause excluded), written on finalize for each signed-in participant with `user_id`.
- **AMRAP detail rows** (`source = amrap_with_friends`): still written by the existing AMRAP sync when an AMRAP block finishes. If that AMRAP session is linked from `trainer_live_activity_segments.amrap_session_id`, a trigger sets `is_active_rest = true` on the AMRAP `workout_logs` row so weekly aggregates that use “exclude active rest” count the **parent** `trainer_live` minutes only, not the nested AMRAP duplicate.
- **Segment drill-down:** query `trainer_live_activity_segments` for `activity_session_id` parsed from `handoff_dedupe_key` (`trainer_live:{user_id}:{activity_session_id}`).

## Rich / multiplayer timers (AMRAP template)

For timers with their own DB tables (e.g. AMRAP With Friends):

1. **Domain table** stores full session data (rounds, participants, etc.). AMRAP uses `segment_index` so each AMRAP workout and each free workout in a session is persisted as its own row.
2. **Trigger / RPC** on completion calls `SECURITY DEFINER` function.
3. Function upserts domain table **and** inserts into `workout_logs` with stable `handoff_dedupe_key`.
4. Use `completed_at::date` (or session timezone) for `workout_logs.date`, not server `current_date`.

## Future timers

When adding a new interval timer:

- **Simple (no DB):** Add `source` to `ALLOWED_SOURCES` and `SOURCE_TO_WORKOUT_NAME` in `log-handoff.ts`; add post-session handoff UI in the spoke app.
- **Rich (own tables):** Copy `20250329000000_amrap_sync_workout_logs.sql` pattern: trigger sync to `workout_logs` on completion with namespaced dedupe key.

### Template for rich timers (own DB tables)

Use AMRAP With Friends as the reference implementation:

1. **Domain table** – Store full session data (participants, rounds, etc.), e.g. `shared.<protocol>_session_results`.
2. **Completion trigger** – `AFTER UPDATE` on session table when `state = 'finished'` → call `persist_*` function.
3. **`SECURITY DEFINER` function** – Same transaction:
   - Upsert into domain table.
   - Insert/upsert into `workout_logs` with:
     - `source` = stable string (e.g. `amrap_with_friends`).
     - `handoff_dedupe_key` = `{source}:{user_id}:{session_id}` (or `...:{segment_index}` for per-segment sources like AMRAP; matches unique partial index).
     - `date` = `(now())::date` (completion date).
     - `duration_seconds`, `rounds`, `workout_name`, etc.
4. **Backfill** – One-time `INSERT ... SELECT` from domain table into `workout_logs` for existing rows, with `ON CONFLICT DO NOTHING`.

Reference: [`supabase/migrations/20250329000000_amrap_sync_workout_logs.sql`](../supabase/migrations/20250329000000_amrap_sync_workout_logs.sql)
