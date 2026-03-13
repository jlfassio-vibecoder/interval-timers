# SWOT Analysis: Post-Workout (Finished) Phase — AMRAP With Friends

**Scope:** The period after the AMRAP timer reaches zero and the workout ends: timer display, LOG ROUND visibility, host livestream, session persistence, and HUD/history integration.

**Components:** `AmrapSessionShell`, `AmrapTimerDisplay`, `AmrapWorkPhaseControls`, `useSessionState`, `useSocialAmrap`, `on_amrap_session_finished` trigger, `shared.amrap_session_results`, `HistoryZone`

**Date:** March 13, 2025

---

## Current Behavior Summary

When the timer reaches zero (or the host taps FINISH):

- **Timer display:** Shows "Complete" / "Work complete" (stone-900 background)
- **LOG ROUND:** Hidden; `AmrapWorkPhaseControls` returns `null` when `timerState === 'finished'`
- **Host livestream:** The host video tile is hidden in finished state (only shown during `waiting`, `setup`, `work`). Agora channel remains connected until the user navigates away
- **Host controls:** Pause/Resume/Skip/Finish are hidden in finished state
- **Session in DB:** Stays in `amrap_sessions` with `state = 'finished'`, `time_left_sec = 0`
- **HUD integration:** `on_amrap_session_finished` trigger calls `persist_amrap_session_results`; results stored in `shared.amrap_session_results` for authenticated participants; HistoryZone displays them with "View session" link

---

## Strengths

| Area | Description |
|------|-------------|
| **Clear completion state** | "Work complete" and "Time Cap" / "Work Complete" provide unambiguous feedback that the workout is over. Users are not left wondering if they should keep logging rounds. |
| **Automatic results persistence** | The `on_amrap_session_finished` trigger fires on `UPDATE ... state = 'finished'` and persists results to `shared.amrap_session_results`. No client-side "Save" button required; data flows automatically. |
| **User-scoped history** | `amrap_session_results` is keyed by `user_id`; only participants with `user_id` (logged-in) get rows. RLS ensures users see only their own results. |
| **HUD continuity** | HistoryZone displays AMRAP With Friends results alongside program-based session history. "View session" links to the session page, enabling replay/recap. |
| **LOG ROUND correctly disabled** | Hiding the LOG ROUND button in finished state prevents late round logging and keeps leaderboard integrity. |
| **Simplified UI in finished** | Host Pause/Resume/Skip/Finish controls are hidden. The finished screen is minimal—timer + "Work complete" + leaderboard—reducing cognitive load. |
| **Realtime consistency** | All clients receive `state = 'finished'` via Realtime; local state syncs from `session.state` in `useSessionState`. Everyone sees the same end state. |
| **Session remains accessible** | Session stays in DB; users can return via HistoryZone "View session" link to review leaderboard and splits. |
| **Conflict handling** | `amrap_session_results` uses `ON CONFLICT (user_id, session_id) DO UPDATE` so repeated finishes or late updates don't create duplicates. |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **No post-workout celebration** | Solo AMRAP uses `playSound('finish')` on completion; Social AMRAP has no sound or visual celebration when the workout ends. The transition feels flat. |
| **No explicit CTA to exit** | The only exit path is "← Exit session" in the header. There is no prominent "Done" or "View results" button in the finished state. Users may linger without guidance. |
| **History only for logged-in users** | Participants without an account never get a row in `amrap_session_results`. Guest users have no way to see their AMRAP With Friends history in the HUD. |
| **Host livestream hidden** | The host video tile is removed in finished state. If users want to debrief or celebrate together on video, the feed is gone. |
| **No analytics on Social finish** | Solo AMRAP tracks `timer_session_complete` with `source: 'amrap'`; Social AMRAP does not emit an equivalent event when a With Friends session finishes. |
| **Limited finished-state context** | "Work complete" is generic. No summary (e.g. "You completed 5 rounds") or encouragement in the finished view. |
| **Session message board still visible** | Message board remains in the right column. No clear indication that the session is effectively "done" from a social perspective. |
| **No export or share of results** | Users cannot easily share their results (e.g. screenshot, link with summary) from the finished view. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **Post-workout celebration** | Add a finish sound and/or brief animation (e.g. confetti, pulse) when transitioning to finished, matching Solo AMRAP's `playSound('finish')`. |
| **Explicit exit CTA** | Add a prominent "Done" / "View in History" button in the finished state that links to HUD HistoryZone or returns to `/with-friends`. |
| **Summary card** | Show a compact summary in finished: e.g. "5 rounds in 15:00" for the current user, with optional "View full leaderboard" expansion. |
| **Keep host livestream in finished** | Consider keeping the host video visible in finished state so participants can debrief, celebrate, or say goodbye before exiting. |
| **Analytics for Social finish** | Emit `timer_session_complete` (or equivalent) for With Friends sessions with `source: 'amrap_friends'` and session metadata. |
| **Guest history** | Persist results for anonymous participants (e.g. via sessionStorage or a temporary identifier) and surface them in a "Recent sessions" list if they create an account later. |
| **Share results** | Add a "Copy results" or "Share" button that generates a text summary (e.g. "AMRAP 15 min: 5 rounds. View: [link]") for social sharing. |
| **Session recap modal** | Optional modal on finish: "Workout complete! You did X rounds. [View leaderboard] [Done] [Share]". |
| **Smooth transition** | Add a short transition animation when moving from work → finished to make the end feel intentional. |

---

## Threats

| Area | Description |
|------|-------------|
| **Trigger timing** | `on_amrap_session_finished` runs on `UPDATE OF state`. If the update fails (e.g. network error), results may never be persisted. There is no client-side retry for `persist_amrap_session_results`. |
| **Race with early exit** | If the host exits the session immediately after finish, Realtime may not have delivered `state = 'finished'` to all participants before they leave. Results are persisted server-side, but clients might miss the final state. |
| **Anonymous participants invisible in history** | Heavy reliance on `user_id` means anonymous users get no history. If the product shifts toward "no account" as a primary path, this becomes a UX gap. |
| **DB growth** | Sessions remain in `amrap_sessions` indefinitely. No cleanup policy for old finished sessions. Long-term storage and query performance could degrade. |
| **Duplicate result rows** | `ON CONFLICT ... DO UPDATE` handles re-runs of `persist_amrap_session_results`, but if the trigger fires multiple times (e.g. due to retries or edge cases), `completed_at` gets overwritten. Ordering/filtering by "most recent" could be ambiguous. |
| **Session page as "dead" state** | The session page in finished state has no host controls and minimal action. Users who bookmark or share the URL later land on a static "Work complete" view with no way to "replay" or start a new workout from that session. |

---

## Integration Notes

- **Solo vs Social:** Solo AMRAP (`useSoloAmrap`) uses local state only; no DB persistence. Social AMRAP persists to Supabase and triggers HUD integration. The finished UX differs: Solo has analytics + sound; Social has persistence + HUD but no celebration or analytics.
- **HistoryZone:** Uses `getAmrapSessionResults(userId)` from `shared.amrap_session_results`. Rows appear under "AMRAP With Friends" with workout label, rounds, duration, date, and "View session" link.
- **Session URL:** `/amrap/with-friends/session/{sessionId}` shows the finished state when `session.state === 'finished'`. Returning users see the static leaderboard and "Work complete".
