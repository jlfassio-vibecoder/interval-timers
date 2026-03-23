# SWOT Analysis: AMRAP With Friends Live Streaming Session

**Scope:** The real-time collaborative AMRAP session experience: Agora video (host livestream, participant video in leaderboard cards), Supabase Realtime state sync, session flow (create/join → waiting → setup → work → finished), and supporting features (message board, Who's Here, warmup overlay, new workout modal).

**Components:** `useSocialAmrap`, `useAgoraChannel`, `useAmrapSession`, `useSessionState`, `AmrapSessionPage`, `AmrapSessionShell`, `LeaderboardRow`, `VideoTile`, `VideoSourcePlayer`, `SessionMessageBoard`, `DailyWarmupSessionOverlay`, `NewWorkoutModal`, Agora token API

**Date:** March 23, 2025

---

## Current Behavior Summary

- **Session flow:** Host creates via RPC (`create_session`), joins via `join_session`; both navigate to `/with-friends/session/:sessionId`
- **Video:** Agora channel per session; `participant_id` used as uid; host livestream below timer during waiting/setup/work (hidden in finished); participant video as leaderboard card backgrounds
- **State sync:** Supabase Realtime on `amrap_sessions`, `amrap_participants`, `amrap_rounds`; host pushes state via `update_session_state` RPC
- **Phases:** waiting → setup (10s) → work → finished
- **Features:** Copy share link, message board, Who's Here, warmup overlay (host video), New Workout modal (host), Post-workout recap, View results, Copy results, Recovery QR (desktop→phone), guest session history
- **Graceful degradation:** Session works without video; `agoraError` surfaced as banner; VideoSourcePlayer handles both Agora tracks and MediaStream (solo)

---

## Strengths

| Area | Description |
|------|-------------|
| **Unified real-time stack** | Supabase Realtime + Agora provide coordinated state and video. Single source of truth (DB) for timer, rounds, participants; video maps cleanly via `participant_id` as Agora uid. |
| **Graceful video degradation** | If Agora fails (token, permissions, network), session continues. `agoraError` shown as banner; leaderboard and host slot render without video. No hard dependency on camera. |
| **Host-centric control model** | Host owns start/skip/pause/finish, New Workout modal, warmup overlay. Clear role separation; participants focus on workout and rounds. |
| **Video in context** | Host livestream positioned below timer (setup/work) for instruction; participant video embedded in leaderboard cards for accountability. Video serves purpose, not vanity. |
| **Token security** | Production Agora token API validates participant exists in `amrap_participants` before issuance. Prevents arbitrary channel join. |
| **Shared shell architecture** | `AmrapSessionShell` + `AmrapSessionEngine` support both Solo and Social; `LeaderboardRow` via `VideoSourcePlayer` handles Agora and MediaStream. Reduces duplication. |
| **Copy share link** | One-tap copy for host; join flow requires session ID + nickname. Low friction for invite. |
| **Post-workout flow** | Recap modal, View results, Copy results, Recovery QR. Multiple exit paths; authenticated users get HUD history via `amrap_session_results`. |
| **Warmup overlay** | Host can run warmup with video before main workout; `DailyWarmupSessionOverlay` reuses host video track. |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **Host livestream hidden in finished** | Host video tile removed when `timerState === 'finished'`. No debrief/celebration on video; abrupt cut from "work" to text-only. |
| **No post-workout celebration** | Solo AMRAP uses `playSound('finish')`; Social has no sound or visual celebration. Transition feels flat. |
| **No video/audio toggles** | Users cannot turn camera/mic off in-session. Always-on video may discourage participation (bandwidth, privacy, appearance). |
| **Token and env fragility** | Agora token requires `VITE_AGORA_APP_ID`, `VITE_AGORA_APP_CERTIFICATE`; "invalid token, authorized failed" often from env mismatch or cert not enabled. Dev needs token server or proxy. |
| **No explicit exit CTA in finished** | Only "← Exit session" in header. No prominent "Done" or "View in History" in finished state. |
| **Anonymous users without history** | Guests don't get `amrap_session_results` rows. `saveGuestSessionResult` helps locally, but no cross-device history until account. |
| **Heavy `useSocialAmrap`** | Hook is ~1000 lines; mixes session, Agora, UI slots, modals, auth. Hard to test and reason about. |
| **Auth loading blocks create and session flows for signed-in users** | When `fetchProfile` or `onAuthStateChange` never settles (or auth init deadlocks), create/join and session fetch stay blocked. Ties to `authLoading` and `useAmrapSession`'s `startFetch: !authLoading` in AmrapWithFriendsPage and useSocialAmrap. |
| **Message board persistence** | Unclear if messages persist across refreshes; UX may suggest ephemeral chat. |
| **No analytics for Social finish** | Solo tracks `timer_session_complete`; Social does not emit equivalent for With Friends sessions. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **Keep host livestream in finished** | Show host video during debrief so participants can celebrate, ask questions, say goodbye before exiting. |
| **Video/audio toggles** | Add camera on/off, mic mute in session. `useAgoraChannel` already exposes `muteVideo`, `muteAudio`; wire to UI. |
| **Post-workout celebration** | Add `playSound('finish')` on transition to finished; optional confetti or pulse. Align with Solo AMRAP. |
| **Explicit exit CTA** | Add "Done" / "View in History" button in finished state; link to HUD HistoryZone or `/with-friends`. |
| **Analytics for Social** | Emit `timer_session_complete` with `source: 'amrap_friends'` and session metadata for funnel and retention. |
| **Scheduled sessions** | `scheduled_start_at` exists on `amrap_sessions`; calendar integration could surface upcoming sessions and reminders. |
| **Recording/playback** | Agora supports cloud recording; optional "Save replay" for host could drive retention and sharing. |
| **Refactor `useSocialAmrap`** | Split into `useAmrapSessionData`, `useAgoraVideo`, `useSessionModals`; compose in page. |
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
