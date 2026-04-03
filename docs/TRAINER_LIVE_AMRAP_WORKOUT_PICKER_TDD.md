# Technical Design: Trainer Live — AMRAP WorkoutPicker (reusable from AMRAP With Friends)

**Status:** Design — implementation pending.  
**Parent:** [TRAINER_LIVE_INTERVAL_WRAPPERS_TDD.md](./TRAINER_LIVE_INTERVAL_WRAPPERS_TDD.md) (wrapper contract, `none` → tool selection), [TRAINER_LIVE_AMRAP_WRAPPER_TDD.md](./TRAINER_LIVE_AMRAP_WRAPPER_TDD.md) (embedded AMRAP engine, `interval_wrapper_config`, attach semantics).  
**Foundational example:** `apps/amrap` — [`AmrapWithFriendsPage.tsx`](../apps/amrap/src/pages/AmrapWithFriendsPage.tsx) + [`WorkoutPicker.tsx`](../apps/amrap/src/components/WorkoutPicker.tsx) + `create_session` RPC (same workout list + duration model as social AMRAP).  
**Integration target:** [`TrainerLiveHostView.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) — header **Start AMRAP** opens the workout modal and runs attach (see §7). [`TrainerLiveSessionRoom.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx) remains layout + embedded AMRAP sidebar only (no duplicate **Start AMRAP** CTA).

---

## 1. Purpose

Today, when the trainer starts AMRAP inside Trainer Live, the server creates a linked `amrap_sessions` row with **fixed defaults** (15 minutes, **empty** workout list) via `trainer_live_attach_amrap_session` → `create_session(15, …, '[]'::jsonb, …)` (see [migration](../supabase/migrations/20260430200000_trainer_live_interval_wrapper.sql)). That does not match the **AMRAP With Friends** experience, where the host explicitly chooses **duration** and **exercises** through **`WorkoutPicker`** before `create_session` runs.

This document specifies a **reusable WorkoutPicker-driven flow** so the trainer **selects the workout that will display and be completed** for the interval block—parity with the foundational AMRAP With Friends implementation—while preserving **single Agora channel**, **embedded** AMRAP UI, and existing **attach / `interval_wrapper_config`** behavior from the parent AMRAP wrapper TDD.

---

## 2. Current vs desired user journey

### 2.1 Today (trainer)

1. Trainer Live session uses `shell = 'countdown_timer'`, `interval_wrapper_kind = 'none'`.
2. Trainer taps **Start AMRAP** in the host chrome ([`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx)).
3. Client calls `trainer_live_attach_amrap_session(p_trainer_live_session_id)` with **no workout inputs**.
4. Sidebar shows embedded AMRAP; workout list/duration reflect **server defaults**, not a deliberate picker choice.

### 2.2 Desired (trainer)

1. Same shell/kind preconditions.
2. Trainer taps **Start AMRAP** in the [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) header (§7).
3. A **modal** opens with the **trainer** workout picker (shared package, §5.2): same **workflow patterns** as AMRAP With Friends—protocol → level or General AMRAP → preset list or build flow; General AMRAP requires **at least one exercise** (§6, §11).
4. On confirm, the app calls attach with **`p_duration_minutes`** and **`p_workout_list`** (same shape as [`AmrapWithFriendsPage`](../apps/amrap/src/pages/AmrapWithFriendsPage.tsx) → `handleCreateSession` / `create_session`).
5. Linked `amrap_sessions` row matches that selection; [`TrainerLiveAmrapWrapper`](../apps/app/src/lib/trainer-live/wrappers/amrap/TrainerLiveAmrapWrapper.tsx) shows the **chosen** workout and timer length for trainer and clients.

**Clients** do not use the picker; they continue to see **Waiting for your trainer…** in the sidebar until `interval_wrapper_kind` becomes `amrap`, then the embedded client UI for the linked session.

---

## 3. Foundational reference (AMRAP With Friends)

| Piece | Role |
|-------|------|
| [`WorkoutPicker`](../apps/amrap/src/components/WorkoutPicker.tsx) | Multi-step UI: `protocol` (general AMRAP build vs beginner/intermediate/advanced), `build` (`BuildWorkoutFlow`), or preset grid after level. **Output:** `onSelect(workoutList: string[], durationMinutes: number)`. Optional `extraContent` (not required for Trainer Live v1). |
| [`amrap-setup-data`](../apps/amrap/src/components/interval-timers/amrap-setup-data.ts) (imported by WorkoutPicker) | `AMRAP_WORKOUT_LIBRARY`, `AMRAP_LEVEL_DURATION`, `AMRAP_PROTOCOL_LABELS`. |
| [`BuildWorkoutFlow`](../apps/amrap/src/components/interval-timers/BuildWorkoutFlow.tsx) | Custom exercise list + duration for “general AMRAP.” |
| [`AmrapWithFriendsPage`](../apps/amrap/src/pages/AmrapWithFriendsPage.tsx) | Wires `onSelect` to `supabase.rpc('create_session', { p_duration_minutes, p_workout_list, … })` (plus scheduling extras **out of scope** here). |

**Contract to preserve:** `create_session` expects `p_workout_list` as JSON array of exercise name strings (see existing Supabase definitions); duration is `p_duration_minutes` (integer). **Trainer Live attach** additionally requires a **non-empty** array at the RPC boundary (§6). **General AMRAP** in the package picker must match the AMRAP With Friends **build** flow: usable, self-serve, and **cannot** complete until there is **at least one** exercise (§11).

---

## 4. Goals and non-goals

### Goals

| ID | Goal |
|----|------|
| **WG1** | **Parity:** Trainer Live AMRAP attach uses the **same** workout list + duration semantics as AMRAP With Friends (picker → `create_session` inputs). |
| **WG2** | **Shared package:** A **new** reusable workout-picker implementation for Mission Control lives in a **`packages/…`** workspace module (name TBD). [`WorkoutPicker`](../apps/amrap/src/components/WorkoutPicker.tsx) and related flows in `apps/amrap` remain the **template**; the package implementation **follows** that UX without requiring `amrap/embed` export gymnastics or alias hacks. |
| **WG3** | **Trainer Live invariants:** No second Agora channel; `interval_wrapper_kind` / `interval_wrapper_config.amrap_session_id` unchanged in meaning ([parent AMRAP TDD](./TRAINER_LIVE_AMRAP_WRAPPER_TDD.md)). |
| **WG4** | **Accessible UX:** Modal focus trap, escape to dismiss, clear **Cancel** path; respect `disabled` while RPC is in flight. |

### Non-goals

| ID | Non-goal |
|----|----------|
| **WN1** | Scheduling AMRAP segments for later (`CreateFlowSchedulePicker` / `p_scheduled_start_at`) inside Trainer Live—**not** part of this slice. |
| **WN2** | Changing client/join RPCs beyond what attach already returns (`host_token`, `amrap_participant_id` for storage). |
| **WN3** | A second **Start AMRAP** entry point in [`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx)—single entry is the host header (§7). |

---

## 5. Architecture

### 5.1 High-level flow

```mermaid
sequenceDiagram
  participant T as Trainer UI
  participant WP as Trainer workout picker (package)
  participant RPC as trainer_live_attach_amrap_session
  participant CS as create_session
  participant TL as trainer_live_sessions

  T->>WP: Open modal (Start AMRAP)
  WP->>T: onSelect(workoutList, durationMinutes)
  T->>RPC: p_trainer_live_session_id, p_duration_minutes, p_workout_list
  RPC->>CS: create_session(duration, host_display, workout_list, …)
  CS-->>RPC: session_id, host_token, participant_id
  RPC->>TL: interval_wrapper_kind=amrap, config amrap_session_id
  RPC-->>T: tokens + ids
  T->>T: setStoredHostToken / setStoredParticipantId; local state → amrap
```

### 5.2 Shared package (decision)

**Approach:** Introduce a **new workspace package** (e.g. under `packages/`, name TBD such as `@interval-timers/amrap-workout-picker`) that contains a **trainer-targeted** workout picker implementation.

- **Template:** The existing [`WorkoutPicker`](../apps/amrap/src/components/WorkoutPicker.tsx), [`BuildWorkoutFlow`](../apps/amrap/src/components/interval-timers/BuildWorkoutFlow.tsx), and [`amrap-setup-data`](../apps/amrap/src/components/interval-timers/amrap-setup-data.ts) in **`apps/amrap`** are the **authoritative reference** for behavior, steps, and data shapes. The package **reimplements** (or selectively extracts) that UX for reuse in **`apps/app`** without coupling Trainer Live to `amrap/embed` bundle-size or `@/` alias rules ([TRAINER_LIVE_AMRAP_WRAPPER_TDD §6.4](./TRAINER_LIVE_AMRAP_WRAPPER_TDD.md)).

- **`apps/amrap`:** May continue to use its current in-app components for AMRAP With Friends; **optional** later refactor to consume the shared package is out of scope for this TDD unless product wants one codebase for both.

- **Bundle / imports:** The package uses normal package exports and shared dependencies (`react`, preset data modules as co-located or imported copies—**keep preset lists in sync** with `apps/amrap` or share a tiny `@interval-timers/amrap-presets` if duplication becomes painful).

- **Styling:** Package components should accept a **`className`** / theme tokens so the modal in Mission Control matches [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) (§8).

### 5.3 Modal component (`apps/app`)

Introduce a small wrapper, e.g. **`TrainerLiveAmrapWorkoutPickerModal`**, in `apps/app/src/components/react/trainer/live/`:

- Props (illustrative): `open`, `onOpenChange`, `onConfirm(workoutList, durationMinutes)`, `onCancel`, `disabled` (during attach).
- Renders a **dialog** (use the same dialog primitive / patterns as other Mission Control modals).
- Children: **workout picker from the shared package** (§5.2) with `onSelect` → call `onConfirm` then close (or parent closes after successful RPC—prefer **parent owns RPC** so the modal can show errors without unmounting picker state prematurely).

**Cancel:** Picker `onCancel` resets internal step state; wire to `onOpenChange(false)`.

**Opened from:** [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) when the user clicks the existing header **Start AMRAP** (§7).

---

## 6. Backend: extend `trainer_live_attach_amrap_session`

**Current signature:** `trainer_live_attach_amrap_session(p_trainer_live_session_id uuid)`.

**Target signature (required arguments):**

```text
trainer_live_attach_amrap_session(
  p_trainer_live_session_id uuid,
  p_duration_minutes int,
  p_workout_list jsonb
)
```

**Rationale:** The product is **pre-MVP** with **no legacy clients** that depend on a zero-argument attach. **`p_duration_minutes`** and **`p_workout_list`** are **required**—no defaults—to enforce the WorkoutPicker contract **at the database layer** and prevent accidental creation of **empty default** sessions (`15` + `'[]'`).

**Validation inside the function (minimum):**

- **`p_duration_minutes`:** Required; must satisfy the same rules as `create_session` (e.g. positive integer, upper bound if any exists in DB or app).
- **`p_workout_list`:** Required; must be a **non-empty JSON array of strings** (at least one exercise name). Reject `NULL`, non-array, or `jsonb_array_length(...) = 0`. This matches **General AMRAP** / build-your-own UX (§11): the host cannot complete attach with zero exercises.

**Call site:**

- Replace `v_created := public.create_session(15, v_display, '[]'::jsonb, NULL, NULL);` with  
  `v_created := public.create_session(p_duration_minutes, v_display, p_workout_list, NULL, NULL);`  
  (argument order must match the live [`create_session`](../supabase/migrations/20260331000000_amrap_guest_claim.sql) signature.)

**Idempotency:** Existing branch “already `amrap` with valid `amrap_session_id`” should remain; **changing** workout mid-session is **out of scope** (separate product decision; see parent TDD switch-away rules).

**Security:** `SECURITY DEFINER`; trainer-only check unchanged. No new public data leaks: workout list is trainer-provided for their own session creation.

---

## 7. UI placement (decision)

**Placement:** [`TrainerLiveHostView.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) **header** only.

- The existing **Start AMRAP** control opens **`TrainerLiveAmrapWorkoutPickerModal`** (§5.3); after the trainer confirms workout + duration, the view calls **`trainer_live_attach_amrap_session`** with the required RPC arguments (§6) and updates local state / tokens as today.

[`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx) keeps its **interval sidebar** and empty-state copy (*“Choose an interval tool above (e.g. Start AMRAP)…”*) **without** a second **Start AMRAP** button—single entry point in the host header.

---

## 8. Visual / UX notes

- **Modal** should use Mission Control surfaces (dark shell, orange accents) consistent with [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) and the sidebar.
- **Shared package** picker is **styled for Trainer Live** (or themeable via props) while **mirroring** the AMRAP With Friends layout and steps from the original [`WorkoutPicker`](../apps/amrap/src/components/WorkoutPicker.tsx).
- While attach is loading, disable picker actions and show **Starting…** on the confirming control (mirror `attachBusy`).

---

## 9. Testing

| Layer | Test |
|-------|------|
| **RPC / migration** | Required `p_duration_minutes` + `p_workout_list`; rejects empty array / null list; forwards to `create_session`; idempotent attach still returns existing session. |
| **App unit** | Modal calls attach with `(duration, list)` from package picker; `disabled` when `attachBusy`; General AMRAP cannot confirm with zero exercises. |
| **Integration** | Trainer: header **Start AMRAP** → modal → preset path → AMRAP sidebar matches; client join sees same `amrap_session_id` state. |
| **Manual** | General AMRAP path: add at least one exercise, complete → session created; attempt to complete with zero exercises blocked in UI (and DB rejects if bypassed). |

---

## 10. Documentation and rollout

- Update [COMMANDS.md](./COMMANDS.md) if a new `supabase db` migration or typegen step is required for the RPC signature change.
- Cross-link from [TRAINER_LIVE_AMRAP_WRAPPER_TDD.md](./TRAINER_LIVE_AMRAP_WRAPPER_TDD.md) §5.3 (attach RPC) to this doc once workout parameters exist.

---

## 11. Resolved product decisions

| Topic | Decision |
|-------|----------|
| **Code organization** | **New shared package** (`packages/…`, name TBD). The **`apps/amrap`** [`WorkoutPicker`](../apps/amrap/src/components/WorkoutPicker.tsx) and related flows are the **template**; **Trainer Live** uses a **new reusable implementation** in that package (not `amrap/workout-picker` nor expanding `amrap/embed` for this UI). |
| **Placement** | **[`TrainerLiveHostView.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) header:** the existing **Start AMRAP** opens the modal. No **SessionRoom** duplicate CTA. |
| **RPC defaults** | **None.** `p_duration_minutes` and `p_workout_list` are **required** on `trainer_live_attach_amrap_session`. Pre-MVP: no backward compatibility for a zero-arg attach; DB enforces the picker contract. |
| **General AMRAP / empty list** | **General AMRAP** (build-your-own) is a first-class path and must remain **clean and usable**—**copy** the AMRAP With Friends workflow. The trainer **cannot** complete with **zero** exercises: **UI** blocks completion until there is at least one exercise, and **`p_workout_list`** must be a **non-empty** JSON array (§6). Preset workouts inherently include exercises. |

---

## 12. Summary

Implement a **new shared-package** workout picker **modeled on** [`WorkoutPicker`](../apps/amrap/src/components/WorkoutPicker.tsx) and AMRAP With Friends, mount it in **`TrainerLiveAmrapWorkoutPickerModal`**, and open it from the **[`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) header** via the existing **Start AMRAP** control. **`trainer_live_attach_amrap_session`** gains **required** `p_duration_minutes` and `p_workout_list` (no defaults), validates a **non-empty** workout list, and calls `create_session` accordingly—eliminating accidental empty default sessions. This preserves **single-channel Trainer Live video**, **embedded AMRAP** behavior, and **behavioral parity** with the foundational AMRAP With Friends flow, including **General AMRAP** with at least one exercise.
