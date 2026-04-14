# Technical Design: Trainer Live — Session Activity Rail for EMOM and other interval protocols

**Status:** Design — pending review.  
**Reviewed codebase:** [`apps/emom/`](../apps/emom/) (standalone EMOM product surface).  
**Parent patterns:** [TRAINER_LIVE_TABATA_WRAPPER_TDD.md](./TRAINER_LIVE_TABATA_WRAPPER_TDD.md), [TRAINER_LIVE_AMRAP_WRAPPER_TDD.md](./TRAINER_LIVE_AMRAP_WRAPPER_TDD.md), consolidated rail flow (`TrainerLiveActivityTimer` + `trainer_live_activity_begin_*_segment` RPCs).  
**Protocol catalog:** [`packages/timer-core/src/intervalTimerProtocols.ts`](../packages/timer-core/src/intervalTimerProtocols.ts) (`VALID_PROTOCOLS` — 12 interval timer pages).  
**Related (different approach):** [TRAINER_LIVE_P3_PROTOCOL_SYNC_TDD.md](./TRAINER_LIVE_P3_PROTOCOL_SYNC_TDD.md) (native `shell` extension + `trainer_live_session_state`). **This doc assumes the AMRAP/Tabata-style path:** `shell = 'countdown_timer'`, `interval_wrapper_kind` + dedicated per-protocol session rows + activity segments.

---

## 1. Purpose

Bring **interval protocols** (starting with **EMOM**, as implemented in `apps/emom`) into **Trainer Live** so trainers launch them **only from the Session Activity rail**, with:

- **Overlays** consistent with AMRAP/Tabata (center column embed, timer background / video tile rules, `trainerLiveEmbed` layout semantics).
- **Analytics** consistent in **shape** with AMRAP/Tabata: **activity session** wall clock, **segment rows** per block, **`trainer_live_activity_finalize`** → training history, plus any protocol-specific session tables needed for embed state sync.

**Scope clarification**

| Source | What it contains |
|--------|-------------------|
| [`apps/emom`](../apps/emom/) | **EMOM only** — [`EmomInterval.tsx`](../apps/emom/src/components/interval-timers/EmomInterval.tsx) (landing, simulator, full-screen timer). |
| `packages/timer-core` | **12 protocols** (`emom`, `tabata`, `amrap`, …) — shared labels and accent themes. |

This document uses **EMOM** as the **first detailed example** (grounded in `apps/emom`) and defines a **repeatable template** so **each** remaining protocol can be added to the rail with the same engineering steps.

---

## 2. Findings from `apps/emom` (`EmomInterval.tsx`)

### 2.1 Product behavior (standalone app)

- **Landing:** Marketing + simulator (fast vs slow pace demo) + “Clockwork Visualizer” canvas — not required inside Trainer Live embed v1; optional future “marketing strip” off.
- **Session setup:** Modal chooses **total rounds** (10 / 20 / 30 minutes ⇒ 10 / 20 / 30 **rounds**; one round = one minute).
- **Timer state machine:** `idle` → `warmup` (10s) → `setup` (uses shared `SETUP_DURATION_SECONDS` from `@interval-timers/timer-core`) → `working` → `resting` → next round or `finished`.
- **Per-minute work tracking:** `secondsInMinute` ticks 0–59; user taps **TASK COMPLETE** to enter `resting`; `taskFinishedAt` records work seconds for “rest earned” display (`60 - taskFinishedAt`).
- **Round history:** `roundHistory: { round, work, rest }[]` — **in-memory only** today; comment notes planned account/history feature.
- **Post-session:** [`buildAccountRedirectUrl('save_session', 'emom', { time })`](../packages/handoff) — Trainer Live should instead feed **finalize / workout_logs** via the activity pipeline (§6).

### 2.2 Dependencies relevant to Trainer Live embed

| Dependency | Use in EMOM app | Trainer Live implication |
|------------|-----------------|---------------------------|
| `@interval-timers/timer-core` | `getProtocolAccent('emom')`, `SETUP_DURATION_SECONDS` | Reuse **accent** for rail button / embed chrome; reuse **setup duration** constant in shared embed shell. |
| `@interval-timers/timer-ui` | `IntervalTimerLanding` | **Not** used inside Trainer Live center column v1; embed should be a **thin shell** (like AMRAP/Tabata wrappers), not full marketing landing. |
| `@interval-timers/handoff` | Post-session redirect | Replace with **activity finalize** + app training log UX for host. |
| Local audio (`AudioContext`) | Beeps for phases | May reuse in embed or delegate to `@interval-timers/timer-sounds`; **must not** open a second Agora channel. |

### 2.3 What must be server-backed for parity with AMRAP/Tabata

Standalone EMOM is **client-local**. Trainer Live requires:

- **Server-authoritative** timer/session row (like `amrap_sessions` / `tabata_sessions`) for **multi-participant sync** and **analytics**.
- **`trainer_live_activity_*` segment** linking that row to the **activity timeline** and **finalize**.

---

## 3. Goals and non-goals

### Goals

| ID | Goal |
|----|------|
| **G1** | **Rail-only entry:** Trainers start EMOM (and future protocols) via **Session Activity** controls + picker, mirroring **AMRAP block** / **Tabata block** (no duplicate header attach). |
| **G2** | **Same wrapper contract** as AMRAP/Tabata: extend [`TrainerLiveIntervalWrapperKind`](../apps/app/src/lib/trainer-live/wrappers/types.ts), [`interval_wrapper_config`](../supabase/migrations/20260430200000_trainer_live_interval_wrapper.sql) JSON, registry in [`wrappers/registry`](../apps/app/src/lib/trainer-live/wrappers/registry.tsx). |
| **G3** | **Single Agora channel:** Embeds use **`skipAgora: true`** (or equivalent) — same rule as [TRAINER_LIVE_TABATA_WRAPPER_TDD.md](./TRAINER_LIVE_TABATA_WRAPPER_TDD.md) §2. |
| **G4** | **Overlays:** Reuse **timer background** / **video tile exclusion** patterns from [`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx) and [`TrainerLiveTimerBackgroundContext`](../apps/app/src/contexts/TrainerLiveTimerBackgroundContext.tsx) for EMOM (and tune per protocol accent). |
| **G5** | **Analytics:** Each block creates an **activity segment** with a foreign key to the protocol session row; **finalize** produces **workout_logs** (or equivalent) with the same **product expectations** as AMRAP/Tabata segments. |

### Non-goals

| ID | Non-goal |
|----|----------|
| **N1** | Porting the full **EMOM marketing landing** (`IntervalTimerLanding` + simulator sections) into Trainer Live. |
| **N2** | **P3** `trainer_live_session_state` as the primary store **unless** product explicitly merges (see §8). |
| **N3** | **Leaderboard** parity with AMRAP for EMOM (unless product asks); focus on **segment + logs + sync**. |

---

## 4. Repeatable integration template (each protocol)

For **each** protocol \(P\) in `VALID_PROTOCOLS` not yet in Trainer Live:

### 4.1 Database

1. **`P_sessions` table** (name TBD per protocol; e.g. `emom_sessions`) — authoritative config + runtime state JSON, `trainer_live_session_id` optional FK for cleanup/analytics (mirror `tabata_sessions` pattern in [TRAINER_LIVE_TABATA_WRAPPER_TDD.md](./TRAINER_LIVE_TABATA_WRAPPER_TDD.md) §5.1).
2. **Widen `interval_wrapper_kind`** CHECK constraint on `trainer_live_sessions` to include **`'emom'`** (and one literal per protocol as they ship).
3. **`trainer_live_activity_segments`:**  
   - Add **`segment_type`** enum value if needed (today includes `warmup`, `amrap`, `tabata`, … — see [20260430232700_trainer_live_tabata_sessions.sql](../supabase/migrations/20260430232700_trainer_live_tabata_sessions.sql)).  
   - Add **`emom_session_id`** (nullable UUID FK) column **parallel** to `amrap_session_id` / `tabata_session_id`.
4. **RPC `trainer_live_activity_begin_emom_segment(...)`** (name illustrative):  
   - Preconditions: `shell = 'countdown_timer'`, activity timer **active/paused** with segment allowed, caller = trainer.  
   - Creates `emom_sessions` row + sets `interval_wrapper_kind = 'emom'`, `interval_wrapper_config = { "emom_session_id": "…" }`.  
   - Closes prior open segment via `_trainer_live_close_open_segment`, inserts segment row with `emom_session_id`.
5. **Optional attach RPC** `trainer_live_attach_emom_session` — only if a **lobby-only** attach path is needed; post–rail-consolidation, **segment RPC** is the source of truth for logging.

### 4.2 Apps (Trainer Live host)

1. [`TrainerLiveActivityTimer`](../apps/app/src/components/react/trainer/live/TrainerLiveActivityTimer.tsx): **“EMOM block”** button + **picker modal** (round count, optional workout list — match product).  
2. New wrapper: **`TrainerLiveEmomWrapper`** (pattern from `TrainerLiveTabataWrapper` / `TrainerLiveAmrapWrapper`).  
3. **Embed package:** `useEmomEmbedded` + `EmomSessionShell` with `shellLayout="trainerLiveEmbed"` — ideally extract **shared timer UI** from `EmomInterval.tsx` **engine** (phases, seconds-in-minute, task complete) into a **`packages/emom-session`** or `apps/emom/src/embed` export to avoid duplicating the 900-line component.

### 4.3 Clients

- **Read-only** subscribers to `emom_sessions` (+ Realtime) with RLS tied to `trainer_live_participants`, same story as Tabata.

### 4.4 Protocol rollout matrix (from `VALID_PROTOCOLS`)

| Protocol | Trainer Live today | Rail + segment RPC | Notes |
|----------|---------------------|--------------------|--------|
| `amrap` | Yes | Yes | Reference |
| `tabata` | Yes | Yes | Reference |
| `emom` | No | **Target v1 for this doc** | Ground `emom_sessions` + RPC on `EmomInterval` semantics |
| Others (`wingate`, `gibala`, …) | No | Follow §4 template | Depends on standalone app maturity |

---

## 5. EMOM-specific design

### 5.1 Config payload (sketch)

Stored on `emom_sessions` (or in `state.config`):

| Field | Type | Notes |
|-------|------|--------|
| `round_count` | int | 1–120 (bounds TBD; standalone uses 10/20/30). |
| `warmup_seconds` | int | Default 10 to match [`EmomInterval`](../apps/emom/src/components/interval-timers/EmomInterval.tsx) (`WARMUP_DURATION_SECONDS`). |
| `workout_list` | jsonb optional | Exercise names per round or single task description — **product**: align with Mission Control flattening if workouts attach from library. |

### 5.2 Runtime state (sketch)

Mirror what the standalone timer needs for sync:

- `phase`: `warmup | setup | working | resting | finished`
- `current_round`, `seconds_in_minute`, `task_finished_at_sec` (nullable), `paused`, `started_at`, monotonic `version` for optimistic concurrency (optional but recommended if multiple viewers).

### 5.3 Trainer Live UI parity with AMRAP/Tabata

- **Center column:** `TrainerLiveEmomWrapper` when `interval_wrapper_kind === 'emom'`.  
- **Video drawer:** Same default-open rules as Tabata/AMRAP when EMOM active ([`TrainerLiveVideoFeedDrawer`](../apps/app/src/components/react/trainer/live/TrainerLiveVideoFeedDrawer.tsx) `defaultOpen` pattern in `TrainerLiveSessionRoom`).  
- **Rail:** “EMOM block” uses **teal** accent from `getProtocolAccent('emom')` for button styling parity with protocol brand.

---

## 6. Overlays (same format and style as AMRAP / Tabata)

### 6.1 Timer background and video spotlight

- **AMRAP/Tabata** use [`TrainerLiveTimerBackgroundProvider`](../apps/app/src/contexts/TrainerLiveTimerBackgroundContext.tsx) and `excludeUidForTiles` in [`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx) to move the trainer (or leader) feed into the **timer background** when appropriate.

**EMOM (and future protocols)** should:

1. Register the same **background slot** API used by existing wrappers (or extend with EMOM-specific **leader** rules if product wants pace clock on host only).  
2. Use **protocol accent** from `getProtocolAccent('emom')` for **chrome** (borders, work phase background) so EMOM **reads** visually related to standalone `EmomInterval` (teal work phase).

### 6.2 “Overlay” vs “full-screen modal”

Standalone EMOM uses a **full-screen modal** (`z-[200]`) for the running timer. Trainer Live embed should use **`trainerLiveEmbed`** layout: **timer occupies center column** under the host nav, **not** a second full-screen portal over video — matching **TabataSessionShell** / **AmrapSessionShell** embed behavior.

---

## 7. Analytics (same pipeline as AMRAP / Tabata blocks)

### 7.1 Segment row

- Insert **`trainer_live_activity_segments`** row with `segment_type = 'emom'` (requires CHECK constraint migration) and `emom_session_id` set.

### 7.2 Activity finalize

- [`trainer_live_activity_finalize`](../supabase/migrations/20260430230000_trainer_live_activity_timer.sql) (and any later extensions) must **include EMOM segments** when building **parent workout_logs** / duration — follow the same extension pattern used when **Tabata** was added (see Tabata migration bundle).

### 7.3 Product analytics (events)

If the product uses **client analytics** (e.g. `@interval-timers/analytics`), emit parallel events to AMRAP/Tabata:

- `trainer_live_activity_emom_segment_started`
- `trainer_live_activity_emom_segment_completed`

(Event names illustrative; align with existing naming conventions in the app.)

### 7.4 EMOM-specific metrics

From `EmomInterval`, high-value fields to persist **per round** (optional v2 table `emom_round_logs` or JSON array on `emom_sessions.state`):

- `work_seconds`, `rest_seconds` per round (derived from `taskFinishedAt` / minute boundary).

---

## 8. Relationship to P3 protocol sync

[TRAINER_LIVE_P3_PROTOCOL_SYNC_TDD.md](./TRAINER_LIVE_P3_PROTOCOL_SYNC_TDD.md) proposes **`trainer_live_session_state`** and **shell enum extension** for Tabata/EMOM.

**Decision for this design:** Prefer shipping **EMOM on the AMRAP/Tabata rail path first** (`countdown_timer` + `interval_wrapper_kind`), because:

- It matches **current production** Trainer Live architecture after rail consolidation.
- It reuses **activity segments + finalize** without waiting for P3.

If P3 lands later, **either**:

- **Merge:** EMOM wrapper reads/writes P3 state instead of `emom_sessions`, or  
- **Keep** `emom_sessions` as the timer source of truth and **mirror** summary fields into P3.

Pick one during implementation; do not block EMOM v1 on P3 unless product mandates unified sync only.

---

## 9. Extraction strategy from `apps/emom`

To avoid maintaining two divergent EMOM UIs:

1. **Extract** a **`useEmomTimerEngine`** hook from `EmomInterval.tsx` (state machine + interval tick + sounds).  
2. **Keep** `EmomInterval.tsx` as the **standalone** composer (landing + modals) using the hook.  
3. **Trainer Live** imports the hook + a thin **`EmomTimerPanel`** for `EmomSessionShell` (`trainerLiveEmbed`).

This mirrors how AMRAP shares embed code between `apps/amrap` and Trainer Live wrappers.

---

## 10. Open questions

1. **Workout attachment:** Does EMOM v1 require **library workouts** (Mission Control) or only **round count** + free-text task?  
2. **Client control:** Can clients **tap “task complete”** or **trainer-only**? (Default: trainer-only; clients read phase.)  
3. **Minimum viable rounds:** Match standalone presets (10/20/30) only, or arbitrary 1–N?  
4. **Finalize semantics:** Should EMOM duration equal **sum of round minutes + warmup + setup**, or **wall clock** from activity timer only?

---

## 11. References

- [`apps/emom/src/components/interval-timers/EmomInterval.tsx`](../apps/emom/src/components/interval-timers/EmomInterval.tsx) — EMOM standalone implementation.  
- [`packages/timer-core/src/intervalTimerProtocols.ts`](../packages/timer-core/src/intervalTimerProtocols.ts) — 12 protocol IDs and accents.  
- [`TrainerLiveActivityTimer.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveActivityTimer.tsx) — Session Activity rail controls.  
- [TRAINER_LIVE_TABATA_WRAPPER_TDD.md](./TRAINER_LIVE_TABATA_WRAPPER_TDD.md) — Tabata wrapper + segment RPC pattern.
