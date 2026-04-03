# Technical Design: Trainer Live P3 — Protocol shells (Tabata / EMOM) + session sync

**Status:** Design only — **not implemented** until this document is reviewed and approved.  
**Parent:** [TRAINER_VIDEO_SESSION_TDD.md](./TRAINER_VIDEO_SESSION_TDD.md) (P0–P2 complete; P2 `countdown_timer` is intentionally **local-only**).  
**Reference pattern:** AMRAP `amrap_sessions` + `update_session_state` + Realtime ([`useAmrapSession`](../apps/amrap/src/hooks/useAmrapSession.ts), [`useSessionState`](../apps/amrap/src/hooks/useSessionState.ts)).

---

## 1. Purpose

Add **server-authoritative** workout protocol state for Trainer Live so **Tabata** and **EMOM** shells stay in sync across trainer and clients, while **video** remains the shared Agora layer ([`TrainerLiveVideoShell`](../apps/app/src/components/react/trainer/live/TrainerLiveVideoShell.tsx)).

**Goals**

- One **sync primitive** (table + RPC + RLS) reusable by multiple shells.
- **Trainer as sole mutator** of protocol state (no AMRAP-style `host_token`; use `auth.uid()` = session owner).
- **Clients read** via RLS + **Supabase Realtime**; **optimistic concurrency** via monotonic `version`.
- **Explicit JSON contracts** per shell in app types + this doc (DB stores `jsonb`; validation in RPC).

**Non-goals (P3)**

- Round logging, leaderboards, or AMRAP feature parity.
- Background/mobile timer accuracy guarantees.
- Changing Agora token rules or participant caps (unless a later revision explicitly requires it).

---

## 2. Authority and identity

| Role | May mutate protocol state? | Basis |
|------|----------------------------|--------|
| Trainer | Yes | `auth.uid() = trainer_live_sessions.trainer_user_id` |
| Client | No | Read-only `SELECT` when a `trainer_live_participants` row exists for `(session_id, user_id)` or anonymous participant row for join link (see RLS below) |

**Decision:** Do **not** introduce a separate host secret for Trainer Live P3. All writes go through `SECURITY DEFINER` RPCs that verify trainer ownership (and optionally that the caller’s participant row has `role = 'trainer'`).

---

## 3. Shell enum extension

Extend `trainer_live_sessions.shell` (today `video_only` | `countdown_timer` per P2) with at least:

- `tabata` — fixed work/rest intervals, finite rounds.
- `emom` — minute buckets; trainer advances or clock drives minute index.

**Migration touchpoints (implementation phase)**

- Replace `trainer_live_sessions_shell_check` to include new literals.
- `trainer_live_create_session`: validate `p_shell` against the same set; reject unknown values.
- `trainer_live_session_join_hints`: already returns `shell`; no semantic change beyond new values.

**App**

- Extend [`apps/app/src/lib/trainer-live/shells.ts`](../apps/app/src/lib/trainer-live/shells.ts) (`TrainerLiveShell`, `parseTrainerLiveShell`, lobby picker).

---

## 4. Config vs runtime state

**Static protocol config** (chosen at session create or first “arm” RPC; rarely changes mid-session):

- Stored on **`trainer_live_sessions.protocol_config jsonb`** (nullable; non-null when `shell` is `tabata` or `emom`).
- Validated in **`trainer_live_create_session`** (or a dedicated `trainer_live_set_protocol_config` RPC if config is set after create).

**Runtime state** (frequent updates during the workout):

- Stored in **`trainer_live_session_state`** (see §5), not mixed into `trainer_live_sessions` row churn, to keep Realtime payloads focused and avoid widening the sessions table.

**Rejected for P3 default:** Single blob on `trainer_live_sessions` combining config + runtime — simpler migration but noisier Realtime and harder RLS granularity.

---

## 5. Table: `trainer_live_session_state`

**Recommendation:** one row per active protocol session, keyed by `session_id`.

| Column | Type | Notes |
|--------|------|--------|
| `session_id` | uuid PK, FK → `trainer_live_sessions(id)` ON DELETE CASCADE | |
| `state` | jsonb NOT NULL | Shape depends on `sessions.shell` (§7). |
| `version` | bigint NOT NULL DEFAULT 0 | Increment on each successful trainer write; clients send `expected_version`. |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

**Optional guardrail:** deferrable trigger or CHECK via trigger: insert/update only allowed when parent `trainer_live_sessions.shell` in `('tabata','emom')` (and optionally `countdown_timer` if ever synced in a later revision — **P3 keeps `countdown_timer` local-only**).

**Indexes:** PK only unless analytics need `updated_at`.

**Realtime:** Add table to Supabase Realtime publication (dashboard or migration) so clients subscribe with `filter: session_id=eq.<uuid>`.

---

## 6. RLS

Enable RLS on `trainer_live_session_state`.

**Suggested policies**

1. **`SELECT`** — Allow if caller is a participant in the session:
   - `EXISTS (SELECT 1 FROM trainer_live_participants p WHERE p.session_id = trainer_live_session_state.session_id AND p.user_id = auth.uid())`
   - **OR** for anonymous clients: participant row exists with `user_id` null and … (anon JWT cannot match `user_id`). **Practical P3 approach:** clients use **authenticated** joins for protocol-heavy flows, **or** expose read via **`SECURITY DEFINER` RPC** `trainer_live_protocol_get_state(p_session_id)` that verifies participant id from a separate secure path. **Preferred simple path:** document that Tabata/EMOM shells require **signed-in** clients for state read, **or** grant `SELECT` where participant exists and rely on unguessable `participant_id` in Agora only — state read still needs DB access.

   **Concrete recommendation:**  
   - **`SELECT`:** authenticated users with `trainer_live_participants.user_id = auth.uid()` for that `session_id`, **plus** `trainer_user_id = auth.uid()` on parent session (trainer dashboard).  
   - **Anonymous joiners:** use RPC **`trainer_live_protocol_get_state(p_session_id)`** returning state json when `auth.uid()` is null **iff** a valid client participant secret is not available — **alternative:** store ephemeral read cap in participant row (out of scope). **Simplest P3:** require **authenticated** client for `tabata` / `emom` join UX (mirror P1 invited sessions already pushing sign-in); document exception for public Tabata later.

2. **`INSERT` / `UPDATE` / `DELETE`** — Deny direct client writes; only **`service_role`** or **no policy** + all writes via RPC.

All mutations go through **`trainer_live_protocol_apply_patch`** (§6.1).

### 6.1 RPC: `trainer_live_protocol_apply_patch`

```text
trainer_live_protocol_apply_patch(
  p_session_id uuid,
  p_expected_version bigint,
  p_patch jsonb
) RETURNS jsonb
```

**Behavior**

- `SECURITY DEFINER`, `SET search_path = pg_catalog, public`.
- Verify session `active` and `auth.uid() = trainer_user_id`.
- Verify `shell` in `('tabata','emom')` (or allowed set).
- `SELECT ... FOR UPDATE` on `trainer_live_session_state` for `p_session_id` (create row lazily with default `state` if missing and version 0).
- If `version != p_expected_version`, raise `STATE_VERSION_MISMATCH` (or return `{ ok: false, code: 'version_mismatch', version, state }` — **prefer raise** for simpler client `catch`).
- Merge `p_patch` into `state` **in SQL** with shell-specific validation function (e.g. `trainer_live_validate_tabata_patch(state, patch)`) or replace whole `state` if patches are too complex.
- `version := version + 1`, `updated_at := now()`, return `{ ok: true, version, state }`.

**Grants:** `GRANT EXECUTE` to `authenticated` only.

**Optional:** thin wrappers `trainer_live_tabata_*` / `trainer_live_emom_*` that build `p_patch` server-side (fewer client bugs). P3 can start with **one patch RPC** + app-built patches.

### 6.2 RPC: `trainer_live_protocol_get_state` (optional)

For clients that cannot use RLS `SELECT` cleanly:

- Input: `p_session_id`.
- Verify caller has a participant row (or trainer owns session).
- Return `{ version, state, updated_at }`.

---

## 7. JSON contracts (normative for implementation)

Types below are **logical**; implement as TypeScript interfaces in `apps/app` and validate in RPC (minimal validation: required keys + numeric bounds).

### 7.1 Shared envelope (inside `state` jsonb)

```json
{
  "kind": "tabata" | "emom",
  "phase": "idle" | "work" | "rest" | "between_rounds" | "finished",
  "paused": false,
  "phase_started_at": "2026-04-02T12:00:00.000Z",
  "phase_end_at": "2026-04-02T12:00:20.000Z",
  "round_index": 0,
  "emom_minute_index": 0
}
```

- **`phase_started_at` / `phase_end_at`:** ISO 8601 UTC from server `now()` at transition; clients derive **display countdown** locally between syncs (same spirit as AMRAP `time_left_sec` tick).
- **`paused`:** when true, clients freeze display at pause instant; server stores optional `paused_at` if resync after long disconnect (TBD in implementation).

### 7.2 `protocol_config` for Tabata

```json
{
  "work_sec": 20,
  "rest_sec": 10,
  "rounds": 8
}
```

Bounds: e.g. `work_sec`/`rest_sec` 5–120, `rounds` 1–30.

### 7.3 `protocol_config` for EMOM

**Decision (document in implementation):** use **session-relative minute index** anchored to **`emom_epoch_at`** (server timestamptz stored in `state` or config when EMOM starts), not wall-clock timezone edge cases.

```json
{
  "total_minutes": 12,
  "emom_epoch_at": "2026-04-02T12:00:00.000Z"
}
```

`emom_minute_index` = floor seconds since `emom_epoch_at` / 60, capped at `total_minutes - 1`, while phase is `work` (or explicit trainer “next minute” overrides index — product choice). **Lock one rule** in implementation PR.

---

## 8. Client clock model

1. **Source of truth:** server-written `phase_*_at` and `version`.
2. **UI tick:** 1s `setInterval` or `requestAnimationFrame` throttled to update **derived** “seconds remaining” from `Date.now()` vs `phase_end_at`.
3. **On Realtime event:** if incoming `version` > local, replace local state; if equal, ignore duplicate.
4. **Trainer actions:** call `apply_patch` with **last known `version`**; on mismatch, refetch state via `get_state` or Realtime snapshot.

---

## 9. UI integration

- Extend [`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx): for `tabata` / `emom`, render **protocol panel** + existing video shell (same as P2 `countdown_timer` layout).
- New hooks: e.g. `useTrainerLiveProtocolState(sessionId, shell)` — subscribes to Realtime, exposes `state`, `version`, `applyPatch` (trainer only).
- **Do not** duplicate Agora join logic; pass through existing [`useTrainerLiveAgoraChannel`](../apps/app/src/hooks/useTrainerLiveAgoraChannel.ts) (or equivalent).

---

## 10. Testing (implementation phase)

- RPC: version mismatch rejects; trainer-only write; ended session rejects.
- RLS: client cannot `UPDATE`; trainer can via RPC only.
- Realtime: two tabs receive state within acceptable latency.
- Manual: invited-only session + Tabata; wrong account cannot write.

---

## 11. Implementation checklist (post-approval)

Use this as the execution order for the **separate implementation pass** (not part of design-only PRs).

1. Migration: `protocol_config` column on `trainer_live_sessions`; `trainer_live_session_state` table; RLS policies; Realtime publication.
2. SQL validation helpers + `trainer_live_protocol_apply_patch` (+ optional `trainer_live_protocol_get_state`).
3. Extend shell CHECK, `trainer_live_create_session`, defaults for initial `state` row (lazy vs on create).
4. App: `shells.ts`, lobby picker, `join_hints` already carries `shell`.
5. `useTrainerLiveProtocolState` + `TrainerLiveTabataPanel` / `TrainerLiveEmomPanel`.
6. Docs: [COMMANDS.md](./COMMANDS.md) one line for P3 migration; update parent TDD P3 row to **complete** when shipped.

---

## 12. Open decisions (resolve before coding)

1. **Anonymous clients** for Tabata/EMOM: require sign-in vs RPC read token (if marketing needs guest).
2. **Patch vs named RPCs** for v1 (recommend patch + strict server validation).
3. **Lazy state row:** create on first trainer action vs `create_session` insert trigger.

---

## 13. Summary

P3 adds **`tabata` and `emom` shells** with **`protocol_config` on the session** and **`trainer_live_session_state` (jsonb + version)** for realtime sync, **trainer-only writes** via **`trainer_live_protocol_apply_patch`**, and **client UI** driven by **server timestamps + local tick**, following AMRAP lessons without copying AMRAP tables or host tokens.
