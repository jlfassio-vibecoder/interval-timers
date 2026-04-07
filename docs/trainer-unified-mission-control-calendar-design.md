# Technical design: Unified trainer calendar (Mission Control)

**Status:** Draft  
**Date:** 2026-04-06  
**Related:** [trainer-roster-calendar-swot.md](./trainer-roster-calendar-swot.md), Performance Lab (`PerformanceLabCalendarSection`, `trainer-client-calendar.ts`)

---

## 1. Purpose

This document describes a **unified trainer calendar** in Mission Control that aggregates the trainer’s scheduling context across all roster clients, while preserving **per-client calendars** that show only that client’s schedule. It specifies **bidirectional consistency** (trainer and client views stay aligned), **conflict handling** when a trainer schedules from a client context, and **group / class** semantics so multiple clients can legitimately share the same time window when they participate in the **same** scheduled event (e.g. Live Session classes).

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **G1 — Unified trainer view** | A single Mission Control surface (route + API) shows time-ordered items for all relevant clients, with filters (client, type, week/month). |
| **G2 — Client-only calendar** | A client’s calendar (HUD and/or Mission Control client tab) lists **only** that client’s commitments; it does not show other clients’ private sessions. |
| **G3 — Bidirectional sync** | Edits made in the unified trainer calendar update underlying records so **client calendars** reflect changes; conversely, client-visible schedule changes (from the client app or APIs that represent “client calendar entries”) **appear** on the trainer’s unified calendar without stale duplication. |
| **G4 — Conflict awareness** | When a trainer schedules from an **individual client** calendar, the system detects **potential conflicts** with that trainer’s other obligations (other clients or trainer blocks) and prompts: **reschedule**, **cancel**, or **create overlapping event** (explicit opt-in to double-book). |
| **G5 — Group / class overlap** | Multiple clients may occupy the **same** time range **without** a conflict **if** they are attached to the **same** group event instance (e.g. shared Live Session / class). Overlap with **different** events remains a conflict unless the user explicitly allows overlap. |

---

## 3. Current state (baseline)

From the SWOT and codebase:

- **Per-client Mission Control calendar** (`/roster/:userId/lab` → Calendar) composes program-derived events, weekly-board cards, and **`client_coach_schedule_instances`** (links to `client_coach_assignments`). Mutations: POST/PATCH/DELETE on trainer-scoped APIs; roster checks via `isUserInViewerRoster`.
- **No unified trainer-wide calendar** exists today; the trainer must open each client to see their schedule together.
- **Timezone** handling for coach instances has been improved (viewer vs client display); unified view must reuse a **single** rule for “wall time” vs “instant” (`timestamptz` storage, IANA zones on profiles).
- **Live Sessions** exist as a parallel flow (`trainer_live_create_session`, lobby/host views); they are not yet first-class rows on the same calendar model as coach schedule instances. The design below treats Live/class as **first-class or linked** event types in the unified model.

---

## 4. Conceptual model

### 4.1 Calendar item (logical)

Every schedulable thing the trainer cares about is a **calendar item** with at minimum:

- `id` (stable per source table)
- `source` (enum: `coach_instance`, `program_day`, `weekly_board_card`, `live_session`, `trainer_block`, …)
- `trainer_user_id`
- `start_at`, `end_at` (or `start_at` + `duration_minutes`; storage as `timestamptz`)
- `visibility` (who may read it: client, trainer, both)
- `participants[]` (user ids + role: `host` | `client` | `cohort`)

**Client calendar** = **filter** `participants` contains `client_user_id = X` and `visibility` allows client.

**Trainer unified calendar** = **filter** `trainer_user_id = current trainer` and all roster clients in scope (or global trainer view).

### 4.2 Single source of truth

Avoid copying the same meeting into two tables. Prefer:

- **Normalized rows** in domain tables (`client_coach_schedule_instances`, `trainer_live_sessions`, …) plus a **materialized view** or **server-side aggregator** that builds the unified list for a time range **OR**
- A thin **`calendar_occurrences`** table (optional future) keyed by `source` + `source_id` if cross-table joins become too heavy.

**Phase 1 recommendation:** implement unified **read** by querying existing tables in one `buildTrainerUnifiedCalendarPayload(from, to, trainerId)` with parallel batched selects, similar to `buildTrainerClientCalendarPayload`, without a new table until volume requires it.

---

## 5. Group / class / Live Session semantics (G5)

### 5.1 Shared event identity

Two clients **do not conflict** at the same `start_at` if:

- They reference the **same** underlying **group occurrence** identifier, e.g. `group_occurrence_id` or `live_session_id` (or `session_id` from Live Sessions), **and**
- The assignment policy marks the event as **multi-participant** (class, group, cohort).

### 5.2 Data linkage (design direction)

- **Live Sessions:** when a session is scheduled with multiple invited clients, persist a **session id** on each participant row or on a parent **session** row; each client’s calendar shows one row pointing at that session; the unified trainer calendar shows **one** block with **N** clients listed.
- **Coach instances (1:1):** `client_coach_schedule_instances` remains per client; no `group_occurrence_id` unless the assignment is explicitly a “group template” that spawns linked instances (future).

### 5.3 Conflict detection rule

When evaluating overlap for a **new** or **moved** instance:

1. Load trainer’s **other** items in `[start, end]` (excluding the same `source_id` being edited).
2. If overlapping item has the **same** `group_occurrence_id` / `live_session_id` as the proposed item → **not a conflict**.
3. If overlapping item is a **different** event → **conflict** (subject to G4 user choice).
4. Optional: **soft conflict** if same time but **different** clients and no group link — always prompt.

---

## 6. Conflict UX (G4)

### 6.1 When to run

- On **POST** / **PATCH** (create or move) from **client calendar** UI **or** when API flag `?checkConflicts=true` (or body `preflight: true`) is set.
- Unified calendar may use **stricter** default: allow overlap only with explicit confirmation everywhere, or only for group-linked events (product decision).

### 6.2 Response shape (preflight)

```json
{
  "ok": true,
  "conflicts": [
    {
      "severity": "hard",
      "startAt": "2026-04-10T15:00:00.000Z",
      "endAt": "2026-04-10T16:00:00.000Z",
      "summary": "Client A — Strength session",
      "source": "coach_instance",
      "sourceId": "uuid"
    }
  ],
  "groupContext": null
}
```

If `conflicts.length > 0`, UI shows:

- **Reschedule** — adjust time on the form and retry.
- **Create overlapping anyway** — sends `allowOverlap: true` (audited) to persist.
- **Cancel** — no write.

Server validates `allowOverlap` only for trainer role and logs for support.

---

## 7. API sketch

| Endpoint | Purpose |
|----------|---------|
| `GET /api/trainer/calendar/unified?from=&to=` | Trainer unified feed for range; query params: optional `clientUserId`, `eventSources`. |
| `GET /api/trainer/clients/:userId/calendar` | **Existing** per-client calendar; remains source for client tab. |
| `POST /api/trainer/clients/:userId/calendar/instances` | **Extend** optional body: `preflight`, `allowOverlap`; or separate `POST .../preflight`. |
| `PATCH .../instances/:id` | Same extensions for move/edit. |

**Client app** (non–Mission Control) endpoints that mutate schedule should emit events or write the same tables so **`GET /api/trainer/calendar/unified`** sees updates (G3). If client-side writes today bypass trainer aggregation, add a **narrow sync path** (webhook, Supabase realtime, or polling) — phased.

---

## 8. UI sketch (Mission Control)

### 8.1 Unified calendar page

- New nav entry under Roster / Mission Control: **“Calendar”** (trainer-wide).
- Views: week / month (SWOT opportunity 4); filters: client, type (program / coach / live / board).
- Clicking an item: **detail drawer** with client list for group events; deep link to client Mission Control.

### 8.2 Per-client calendar (existing)

- Remains **single-client** view; implements conflict modal when creating/editing coach instances (G4).
- Copy: clarify that unified view is the “all clients” lens.

---

## 9. Bidirectional sync (G3)

| Direction | Mechanism |
|-----------|-----------|
| Trainer → client | Writes go through existing instance / session tables; client calendar GETs already read those sources — **no duplicate** if unified is read-only aggregate. |
| Client → trainer | Any client-originated schedule row must be stored in a table included in `buildTrainerUnifiedCalendarPayload` (e.g. client accepts coach assignment, client logs plan). If today only trainer writes instances, **scope phase 2** to add client-initiated “proposed times” or sync from client HUD `ScheduleZone` if product requires it. |

**Consistency:** all times stored as **`timestamptz`**; display uses trainer profile + client profile zones as today.

---

## 10. Non-goals (v1)

- Recurrence engines (RRULE) — can wrap later.
- External calendar sync (Google/ICS two-way) — optional export only.
- Replacing program-day generation (`getCalendarEventsForRange`) — read-only strip remains until program model evolves (SWOT weakness 7).

---

## 11. Risks (from SWOT, extended)

- **Timezone bugs** — unified view must not mix “column date” semantics; use one library path (e.g. Luxon) for boundaries.
- **Performance** — aggregating N clients × range requires indexes on `(trainer_user_id, scheduled_at)` and session tables; may need composite APIs or caching.
- **Security** — unified endpoint must enforce **only this trainer’s** roster rows; same posture as `isUserInViewerRoster`.
- **UX expectations** — trainers will compare to Google Calendar; conflict UX and month view should be prioritized after MVP aggregate.

---

## 12. Phased delivery (suggested)

1. **Phase A — Read-only unified** — `GET` unified feed + Mission Control page; no new writes. **Implemented** — see §12.1.
2. **Phase B — Conflict preflight** — integrate with client calendar POST/PATCH; `allowOverlap`.
3. **Phase C — Live / class grouping** — link Live Session participants to one `session_id` on unified calendar; group overlap rules.
4. **Phase D — Client-originated entries** — client schedule read aggregation for trainers — see §12.4 (writes: D2 options in same section).

### 12.1 Phase A implementation (2026-04-06)

- **API:** `GET /api/trainer/calendar/unified?from=YYYY-MM-DD&to=YYYY-MM-DD` — [`apps/app/src/pages/api/trainer/calendar/unified.ts`](../apps/app/src/pages/api/trainer/calendar/unified.ts). Server aggregation in [`apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts`](../apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts): `fetchTrainerRoster` → batched parallel `buildTrainerClientCalendarPayload` (chunk size 6) → flattened `items` with `clientUserId` / `clientLabel`, sorted by time; `viewerTimezone` from payloads. Reuses `validateCalendarRange` (93-day cap).
- **UI:** Mission Control sidebar **Calendar** → `/trainer/roster/calendar` — [`apps/app/src/components/react/trainer/views/TrainerUnifiedCalendarView.tsx`](../apps/app/src/components/react/trainer/views/TrainerUnifiedCalendarView.tsx). Week columns use trainer profile timezone (`trainer-calendar-time` helpers). Link to client Performance Lab per row.
- **Routing:** [`apps/app/src/components/react/trainer/TrainerRoute.tsx`](../apps/app/src/components/react/trainer/TrainerRoute.tsx) — `roster/calendar` registered before `roster/welcome*` and `roster/:userId`; nav active state excludes unified path from **Roster** highlight.
- **Scope:** Program days + coach schedule instances only (parity with per-client calendar JSON, not weekly-board UI merge). No Live rows, no writes from this page.

### 12.2 Phase B — Conflict preflight + `allowOverlap` (2026-04-06)

- **Overlap rule:** Each coach instance uses `scheduled_at` plus a fixed slot length **`COACH_SCHEDULE_CONFLICT_SLOT_MINUTES` (60)** in [`apps/app/src/lib/supabase/admin/trainer-client-calendar.ts`](../apps/app/src/lib/supabase/admin/trainer-client-calendar.ts). Conflicts are **other** `client_coach_schedule_instances` for the **same trainer** whose slots intersect the proposed slot. **PATCH** excludes the row being edited; **PATCH** with only `assignmentId` (no `scheduledAt`) skips conflict checks.
- **API:** `POST /api/trainer/clients/:userId/calendar/instances` and `PATCH .../instances/:instanceId` accept optional `preflight: true` (validation + conflict scan only; **200** `{ ok: true, conflicts }`, no write) and `allowOverlap: true` (persist even when `conflicts.length > 0`). Without `allowOverlap`, conflicting writes return **409** `{ error: 'Scheduling conflict', conflicts: [...] }`. Conflict items include `source: 'coach_instance'`, `sourceId`, `clientUserId`, `startAt`, `endAt`, `summary`, `severity: 'hard'`.
- **UI:** [`apps/app/src/components/react/trainer/views/PerformanceLabCalendarSection.tsx`](../apps/app/src/components/react/trainer/views/PerformanceLabCalendarSection.tsx) — on **409**, a modal lists conflicts; **Schedule anyway** retries with `allowOverlap: true`; **Edit time** / **Cancel** dismiss the modal.
- **Logging:** When a write proceeds with `allowOverlap` and overlapping items exist, a structured `console.warn` runs in **DEV** or when `PUBLIC_ENABLE_ERROR_LOGGING` is true.

### 12.3 Phase C — Live / class grouping (`session_id` + overlap rules)

- **Schema:** Optional `client_coach_schedule_instances.trainer_live_session_id` → `trainer_live_sessions(id)` — migration [`20260430234000_client_coach_schedule_instances_trainer_live_session_id.sql`](../supabase/migrations/20260430234000_client_coach_schedule_instances_trainer_live_session_id.sql). Server validation via `validateTrainerLiveSessionForCoachLink` in [`trainer-client-calendar.ts`](../apps/app/src/lib/supabase/admin/trainer-client-calendar.ts): session must belong to the viewer trainer; client must match `invited_client_user_id` or be a `trainer_live_participants` row (`role = client`).
- **API:** `POST` / `PATCH` coach instance bodies accept optional `trainerLiveSessionId` (UUID string or `null` to clear). **PATCH** may send **only** `trainerLiveSessionId` to link or clear without changing time/assignment.
- **Conflict rules:** `findCoachScheduleConflictsForTrainer` accepts `proposalTrainerLiveSessionId`. Overlapping coach rows with the **same** non-null `trainer_live_session_id` as the proposal are **not** conflicts. Overlapping **other** `trainer_live_sessions` (same trainer, interval from `created_at` to `ended_at` or slot length) add conflicts with `source: 'live_session'`.
- **Unified calendar:** [`trainer-unified-calendar.ts`](../apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts) loads Live sessions in `[from, to]` on `created_at`, attaches client participants + profile labels, emits `kind: 'live_session'` rows. Per-client coach instances with `trainerLiveSessionId` in that set are **omitted** from the flattened list so the trainer sees **one** block per session. [`TrainerUnifiedCalendarView.tsx`](../apps/app/src/components/react/trainer/views/TrainerUnifiedCalendarView.tsx) renders Live rows with participant summary and link to `/trainer/live/:sessionId`.
- **Time semantics (v1):** Live placement uses `trainer_live_sessions.created_at` within the calendar range; future **scheduled** Live may use a dedicated column.

### 12.4 Phase D — Client-originated entries (read aggregation)

- **Sources:** Admin fetchers in [`apps/app/src/lib/supabase/admin/trainer-client-calendar-client-originated.ts`](../apps/app/src/lib/supabase/admin/trainer-client-calendar-client-originated.ts): `scheduled_workouts` and **scheduled** `amrap_sessions` (creator or participant), scoped by `user_id` / `client_user_id` and calendar `from`/`to`. Used only from [`buildTrainerClientCalendarPayload`](../apps/app/src/lib/supabase/admin/trainer-client-calendar.ts) after roster checks.
- **Event kinds:** `kind: 'scheduled_workout'` (HUD Schedule workout / timer) and `kind: 'amrap_scheduled'` (`draggable: false`), merged into the same `events` array as program + coach rows; sort via `compareTrainerCalendarApiEvents` (program → client-originated → coach).
- **UI:** Read-only sky styling in [`PerformanceLabCalendarSection.tsx`](../apps/app/src/components/react/trainer/views/PerformanceLabCalendarSection.tsx) and [`TrainerUnifiedCalendarView.tsx`](../apps/app/src/components/react/trainer/views/TrainerUnifiedCalendarView.tsx).
- **Security:** Service-role reads are gated by existing `isUserInViewerRoster` before any client-originated fetch runs.

**Phase D2 — Client writes (product choice, not implemented here):** (1) Client-auth POST/PATCH on `client_coach_schedule_instances` with RLS; (2) `client_schedule_proposals` queue for trainer approval; (3) aggregation-only (current shipped path).

---

## 13. Open questions

1. Should **weekly-board** cards appear on the **unified** trainer calendar, or only coach instances + Live + program?
2. Do **trainer personal blocks** (travel, admin) exist as a table, or should v1 ignore trainer-only busy time?
3. **Minimum overlap window** for conflict: 1 minute, 15 minutes, or exact timestamp equality?

---

## 14. Summary

A **unified trainer calendar** is a **filtered, aggregated read** over existing per-client and session data, plus **write-time conflict rules** and **group identifiers** for Live/class sessions. Per-client calendars stay **private to that client** while remaining **consistent** with the same underlying rows. Implementation can start with a **read-only unified API and page**, then add **preflight conflicts** and **session-level grouping** before expanding client-originated writes.
