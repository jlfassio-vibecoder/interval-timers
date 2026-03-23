# SWOT Analysis: AMRAP With Friends Live Streaming Session

**Scope:** The real-time collaborative AMRAP session experience: Agora video (host livestream, participant video in leaderboard cards), Supabase Realtime state sync, session flow (create/join → waiting → setup → work → finished), and supporting features (message board, Who's Here, warmup overlay, new workout modal).

**Components:** `useSocialAmrap`, `useSocialAmrapEffects`, `socialAmrapUtils`, `AmrapAuthContext`, `useAgoraChannel`, `useAmrapSession`, `useSessionState`, `AmrapSessionPage`, `AmrapSessionShell`, `LeaderboardRow`, `VideoTile`, `VideoSourcePlayer`, `SessionMessageBoard`, `DailyWarmupSessionOverlay`, `NewWorkoutModal`, Agora token API

**Date:** March 23, 2026

**Recently shipped (PR #97 / `fixes/amrap`):** `AmrapAuthContext` avoids awaiting `fetchProfile` inside `onAuthStateChange` (defers via `queueMicrotask`) to prevent Supabase auth lock deadlocks; 3s safety timeout and `mountedRef` guards avoid indefinite loading and updates after unmount. Social AMRAP side effects moved to `useSocialAmrapEffects` (animations, scheduled countdown, finish sound, `timer_session_complete` with `source: 'amrap_friends'`, guest result save); pure helpers live in `socialAmrapUtils`.

---

## Current Behavior Summary

- **Session flow:** Host creates via RPC (`create_session`), joins via `join_session`; both navigate to `/with-friends/session/:sessionId`
- **Video:** Agora channel per session; `participant_id` used as uid; host livestream below timer during waiting/setup/work/finished; participant video as leaderboard card backgrounds
- **State sync:** Supabase Realtime on `amrap_sessions`, `amrap_participants`, `amrap_rounds`; host pushes state via `update_session_state` RPC
- **Phases:** waiting → setup (10s) → work → finished
- **Features:** Copy share link, message board, Who's Here, warmup overlay (host video), New Workout modal (host), Post-workout recap, View results, Copy results, Recovery QR (desktop→phone), guest session history
- **Session as container:** Live session is a container for warmup overlay, first AMRAP, and multiple AMRAPs via host **New Workout** (when finished, host picks next workout and timer returns to setup). **Continue** dismisses recap without leaving; **Exit session** leaves the stream. Future: cooldown interval.
- **Graceful degradation:** Session works without video; `agoraError` surfaced as banner; VideoSourcePlayer handles both Agora tracks and MediaStream (solo)
- **Auth (`AmrapAuthContext`):** Session/user updates in `onAuthStateChange` stay synchronous; profile load runs outside the callback; loading clears after profile completes, on sign-out, or after a 3s safety timeout if the profile query stalls.
- **Social effects (`useSocialAmrapEffects`):** Join animations, waiting-room countdown and host auto-start at `scheduled_start_at`, finish chime (`'finish'` via shared audio context pattern), analytics grace window for late realtime rounds, idempotent guest history save when the session ends.

---

## Strengths

| Area | Description |
|------|-------------|
| **Unified real-time stack** | Supabase Realtime + Agora provide coordinated state and video. Single source of truth (DB) for timer, rounds, participants; video maps cleanly via `participant_id` as Agora uid. |
| **Graceful video degradation** | If Agora fails (token, permissions, network), session continues. `agoraError` shown as banner; leaderboard and host slot render without video. No hard dependency on camera. |
| **Host-centric control model** | Host owns start/skip/pause/finish, New Workout modal, warmup overlay. Clear role separation; participants focus on workout and rounds. |
| **Video in context** | Host livestream positioned below timer (setup/work/finished) for instruction and debrief; participant video embedded in leaderboard cards for accountability. Video serves purpose, not vanity. |
| **Token security** | Production Agora token API validates participant exists in `amrap_participants` before issuance. Prevents arbitrary channel join. |
| **Shared shell architecture** | `AmrapSessionShell` + `AmrapSessionEngine` support both Solo and Social; `LeaderboardRow` via `VideoSourcePlayer` handles Agora and MediaStream. Reduces duplication. |
| **Copy share link** | One-tap copy for host; join flow requires session ID + nickname. Low friction for invite. |
| **Post-workout flow** | Recap modal, View results, Copy results, Recovery QR. Multiple exit paths; authenticated users get HUD history via `amrap_session_results`. |
| **Warmup overlay** | Host can run warmup with video before main workout; `DailyWarmupSessionOverlay` reuses host video track. |
| **Resilient auth init** | Profile fetch is deferred out of `onAuthStateChange` so nested Supabase work does not contend for the same auth lock; safety timeout + mount guards reduce indefinite spinners and stray updates after unmount. |
| **Composable Social code** | `socialAmrapUtils` centralizes formatting and leaderboard math; `useSocialAmrapEffects` isolates timed/audio/analytics/guest-save behavior so `useSocialAmrap` stays focused on orchestration and UI. |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **Post-workout celebration is subtle** | Finish sound + particle burst (Social) align with Solo; optional host-led debrief UI remains an opportunity. |
| **No video/audio toggles** | Users cannot turn camera/mic off in-session. Always-on video may discourage participation (bandwidth, privacy, appearance). |
| **Token and env fragility** | Agora token requires `VITE_AGORA_APP_ID`, `VITE_AGORA_APP_CERTIFICATE`; "invalid token, authorized failed" often from env mismatch or cert not enabled. See `docs/ROADMAP_AMRAP_VIDEO_INTEGRATION.md` troubleshooting checklist; client error hints improved. |
| **Anonymous users without history** | Guests don't get `amrap_session_results` rows. `saveGuestSessionResult` stores locally; Recent sessions (this device) + sign-in CTA after finish improve awareness. Phase B (claim RPC) would enable cross-device sync. |
| **Large `useSocialAmrap` surface** | Core hook still coordinates Agora, UI slots, modals, and session join/create flows; helpers and effects are extracted but the file remains a dense integration point. |
| **Message board persistence** | Unclear if messages persist across refreshes; UX may suggest ephemeral chat. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **Video/audio toggles** | Add camera on/off, mic mute in session. `useAgoraChannel` already exposes `muteVideo`, `muteAudio`; wire to UI. |
| **Richer post-workout celebration** | Optional host-led debrief UI or additional flourish on top of the existing finish sound and particle burst. |
| **Deeper Social analytics** | Extend `timer_session_complete` (already emitted with `source: 'amrap_friends'`) with session id, participant count, or funnel metadata as needed. |
| **Scheduled sessions** | `scheduled_start_at` exists on `amrap_sessions`; calendar integration could surface upcoming sessions and reminders. |
| **Recording/playback** | Agora supports cloud recording; optional "Save replay" for host could drive retention and sharing. |
| **Further split `useSocialAmrap`** | Continue extracting Agora wiring, modal state, or join/create RPCs into focused hooks; `socialAmrapUtils` + `useSocialAmrapEffects` are first steps. |
| **Guest → account handoff** | When guest creates account, merge `saveGuestSessionResult` data into `amrap_session_results` so past sessions appear in HUD. |

---

## Threats

| Area | Description |
|------|-------------|
| **Agora token / env issues** | Mismatched App ID, Certificate, or CORS can block all video. Production deploys must verify env parity with Agora Console. |
| **Network partitions** | If host loses connection, `update_session_state` fails; participants may see stale state. No automatic host handoff. |
| **Realtime delivery lag** | Under load, Supabase Realtime can delay. Participants might see rounds or state changes seconds late. |
| **Race with early exit** | Host exits immediately after finish; some participants may not receive `state = 'finished'` before navigating away. Persistence is server-side but UX can feel inconsistent. |
| **Camera permission denial** | User denies camera; session works but video sections show nothing. No clear guidance ("Video unavailable" only when Agora errors, not permission). |
| **Token expiry** | Long sessions may hit Agora token TTL; no refresh flow. User would need to rejoin. |
| **Scalability of video** | Many participants → many remote streams. Roadmap mentions limiting subscriptions (e.g. host + N); not implemented. |
| **DB growth** | Finished sessions stay in `amrap_sessions`; no cleanup policy. Query and storage costs can grow. |

---

## Future / Planning

- **Profile-backed host identity:** Prefill host (and optionally joiner) nickname from profile / `user.user_metadata` so signed-in users are not forced to re-enter a name each session.
- **Host profile for attendees:** Surface optional, consent-based profile fields (e.g. display name, avatar, short bio) in "Who's here" or a host card—requires schema/API and UX decisions later.

---

## Integration Notes

- **Agora ↔ Supabase:** Agora channel = `session_id`; uid = `participant_id`. Token API checks `amrap_participants` before issuing.
- **Solo vs Social:** Same `AmrapSessionShell` and `LeaderboardRow`; Social injects `videoTrack` from `useAgoraChannel` via `participantsEngine`.
- **Host livestream slot:** Rendered in `useSocialAmrap` `hostLivestreamSlot`, passed as `engine.slots.afterTimer`; `AmrapSessionShell` renders it between timer and controls.
- **Recovery QR:** Desktop users can open PWA on phone via QR when finished; `recoveryUrl` built from `buildRecoveryUrl`.
- **Auth + session gating:** Pages that gate fetches on `authLoading` (e.g. With Friends create/join) rely on `AmrapAuthProvider` settling promptly; deferred profile fetch keeps that path from deadlocking on the Supabase auth lock.
- **Social analytics path:** `useSocialAmrapEffects` fires `timer_session_complete` after a short grace period so late `amrap_rounds` rows from Realtime are included in the round count.
- **Multi-workout follow-ups:** Rounds are cumulative per `session_id`; leaderboard shows totals across all AMRAP segments in the livestream. HUD `amrap_session_results` overwrites per finish; multi-segment aggregation may need schema work later. Cooldown interval planned for future.
