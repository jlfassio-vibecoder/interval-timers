# Technical Design: Trainer Live — Rejoin (AV recovery without losing session)

**Status:** Implemented — in review.  
**Related code:** [`TrainerLiveVideoShell`](../apps/app/src/components/react/trainer/live/TrainerLiveVideoShell.tsx), [`useTrainerLiveAgoraChannel`](../apps/app/src/hooks/useTrainerLiveAgoraChannel.ts), [`TrainerLiveAgoraProvider`](../apps/app/src/contexts/TrainerLiveAgoraContext.tsx), [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx), [`TrainerLiveClientJoinPage`](../apps/app/src/components/react/trainer/live/TrainerLiveClientJoinPage.tsx).

---

## 1. Purpose

Today, **Leave room** tears down Agora, clears `sessionStorage` for the live participant id, and **navigates away** (trainer → `/live`, client → `/live/join/:sessionId`). There is **no in-room control** to recover from intermittent **audio/video** issues without leaving the session entirely.

**Goals**

- Add a **Rejoin** (or **Reconnect audio & video**) control available to **both trainer and clients** while inside the live room.
- **Soft-recover** the media pipeline: leave the Agora RTC channel and join again with the **same** Trainer Live identity, without abandoning the React tree or Supabase-backed session state.
- **Do not** clear or reset user-visible **session data** (see §4) as part of rejoin.

**Non-goals**

- Replacing **Leave room** or **End session for everyone** (trainer).
- Guaranteed fix for hardware/OS permission issues (rejoin may still surface the same permission error; copy should set expectations).
- Changing participant caps or RLS as part of rejoin.
- Broad DB schema redesign; this work adds a **targeted** Supabase migration to `trainer_live_join_session` (idempotent client join for signed-in users), not a general schema change.

---

## 2. Problem statement

Agora Web can occasionally get into bad local or subscription states (tracks not publishing, one-way audio, remote tiles stuck). Coaches and clients need a **supported, discoverable** recovery path that is lighter than a full leave + navigate + re-enter flow.

---

## 3. Comparison: Leave room vs Rejoin

| Action | Agora | `sessionStorage` (`trainer_live:*:participant_id`) | Navigation | Server participant row | Activity / chat / timer state |
|--------|--------|------------------------------------------------------|------------|-------------------------|--------------------------------|
| **Leave room** (current) | `leave()` + cleanup | **Removed** | **Yes** (away from room) | Unchanged (no leave RPC today) | Largely lost in UI because route/context unmounts |
| **Rejoin** (proposed) | Controlled teardown + **join again** | **Preserved** | **No** (stay on same route) | Unchanged | **Preserved** (same `sessionId`, `participantId`, providers) |

---

## 4. Definition: “Session data” that must not be lost

Rejoin must **not** unmount the live session shell or reset these unless a catastrophic error forces full reload (out of scope for the button’s happy path):

| Data | Mechanism today | Rejoin requirement |
|------|-----------------|---------------------|
| Trainer Live **participant id** | React state + optional `sessionStorage` | Same id before/after; **do not** `removeItem` storage key |
| **Session id** | URL / props | Unchanged |
| **Activity timer / segments** | Supabase + hooks keyed by `sessionId` + `participantId` | Same keys; no reset RPC |
| **Chat / reactions** | Supabase + Realtime | Same participant row; streams stay valid |
| **Shell / wrapper state** (AMRAP, Tabata, etc.) | React + server state | No intentional remount of `TrainerLiveSessionRoom` tree |
| **Agora token** | `useAgoraToken` / secure gate in `TrainerLiveAgoraProvider` | May **refetch** token before reconnect if TTL is short (see §6.2) |

**Explicitly out of “loss” for this feature:** transient UI such as “camera muted” toggle state — acceptable to reset to a defined default after rejoin if the implementation replaces tracks (document actual behavior in PR).

---

## 5. UX specification

### 5.1 Placement and copy

- **Location:** Same control surface as **Leave room** — e.g. adjacent button in [`TrainerLiveVideoShell`](../apps/app/src/components/react/trainer/live/TrainerLiveVideoShell.tsx) control bar (trainer **and** client use this component).
- **Primary label (proposal):** **Rejoin** or **Reconnect video** — pick one product term and use consistently; subtitle/tooltip can clarify: “Leave and re-enter the call without leaving the workout.”
- **Disabled state:** While a rejoin is in progress (see §6), disable **Rejoin** (and optionally **Leave room**) to prevent overlapping operations.

### 5.2 Feedback

- Brief **loading** indicator on the button or a thin banner: “Reconnecting…”
- On failure: non-destructive **inline error** (reuse existing amber banner pattern in the video shell) with **Retry** that calls rejoin again.
- **Accessibility:** `aria-busy` on the control region during reconnect; focus management: keep focus on the triggering button or move to the error banner per existing app patterns.

### 5.3 Parity

- **Trainer** and **client** see the **same** control and behavior; no role-gated copy unless legally required (default: identical).

---

## 6. Technical design

### 6.1 Core behavior

**Rejoin** = fully tear down the current Agora client session and **join the channel again** with the same:

- `sessionId` (channel name / token request context),
- `participantId` (uid / identity),
- token acquisition path (secure vs legacy) as today.

**Important:** The join logic lives in a `useEffect` in [`useTrainerLiveAgoraChannel`](../apps/app/src/hooks/useTrainerLiveAgoraChannel.ts). Calling the exported `leave()` alone does **not** re-run that effect unless **dependencies change**. Implementation must therefore expose one of:

1. **`rejoin()`** implemented inside the hook: `await leave()` then bump internal **`reconnectGeneration`** state included in the effect dependency array so cleanup + join runs in a defined order; or  
2. **`reconnectNonce`** owned by `TrainerLiveAgoraProvider` passed into the hook so the effect re-runs without navigating.

Either way, reuse the existing **`previousLeavePromiseRef`** pattern so a new join awaits the previous leave.

**Recommendation:** Implement **`rejoin(): Promise<void>`** on the hook result (and context) to centralize ordering and avoid duplicate `leave()` + effect races from callers.

### 6.2 Token refresh (secure sessions)

For **`TrainerLiveAgoraProvider`** with `useSecure`:

- Before or as part of rejoin, if tokens are short-lived, call **`agoraTok.refetch()`** (or equivalent) so reconnect does not reuse an **expired** token.
- Sequence (conceptual): optional refetch → `rejoin()` in the channel hook.

Document the exact order in implementation; add a test or mocked sequence if feasible.

### 6.3 Interaction with “Leave room”

- **Leave room** continues to: `await leave()` → `onLeaveRoom()` (storage + navigate).
- **Rejoin** must **not** invoke `onLeaveRoom()` or clear storage.

### 6.4 Edge cases

| Case | Expected behavior |
|------|-------------------|
| User taps Rejoin twice quickly | Second tap no-op while first in flight; button disabled + `aria-busy` |
| Rejoin during initial connect | Either disable Rejoin until `joined` is true, or define safe behavior (prefer disable until first successful join) |
| Permission revoked mid-session | Rejoin may fail with permission error; show message; do not clear session |
| Trainer ends session during rejoin | Provider unmounts; cleanup runs as today; no orphan join |

---

## 7. Testing strategy

### 7.1 Automated

- **Unit / hook tests** (where the repo already tests hooks): mock Agora client; assert `rejoin()` invokes leave path then re-join path; assert `reconnectGeneration` / deps trigger a single full cycle.
- **Context test:** `TrainerLiveAgoraProvider` exposes `rejoin` to consumers; `TrainerLiveVideoShell` calls it from the button handler.

### 7.2 Manual QA checklist

- Trainer: open live session, start video; tap **Rejoin**; verify local + remote tiles recover, activity timer unchanged.
- Client: same; verify chat still works with same display identity.
- Secure token path: long session or forced expiry simulation — rejoin still succeeds after refetch.
- Regression: **Leave room** still clears storage and navigates; **End for everyone** unchanged.

---

## 8. Implementation checklist (post-approval)

1. Extend [`useTrainerLiveAgoraChannel`](../apps/app/src/hooks/useTrainerLiveAgoraChannel.ts) with **`rejoin()`** (and internal reconnect trigger), preserving leave/join ordering.
2. Plumb **`rejoin`** through [`TrainerLiveAgoraContext`](../apps/app/src/contexts/TrainerLiveAgoraContext.tsx) (and token refetch if needed).
3. Add **Rejoin** button + loading/error UX to [`TrainerLiveVideoShell`](../apps/app/src/components/react/trainer/live/TrainerLiveVideoShell.tsx).
4. **No** changes to `onLeaveRoom` in host/client pages except if a shared handler is extracted for clarity (optional).
5. Tests + manual QA per §7.

---

## 9. Open questions (for review)

1. **Label:** “Rejoin” vs “Reconnect” vs “Restart camera & mic” — product/copy preference.
2. **Analytics:** Should rejoin fire an event (count, success/fail) for diagnosing AV issues?
3. **Token TTL:** Confirm production token lifetime; drives whether refetch-on-rejoin is mandatory or best-effort.

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Double-connection or race if deps fire twice | Single `rejoin()` API; await `previousLeavePromiseRef`; disable UI while in flight |
| Stale secure token on reconnect | Refetch token before join on secure path |
| User confuses Rejoin with Leave | Distinct styling; Leave stays destructive (red); Rejoin secondary |

---

## Document history

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | — | Initial TDD for review |
