# Technical Design: Unified Calendar — Open, Edit & Reorder (Trainer)

**Status:** Draft (decisions resolved; **P0/P1/P2** implemented in app)  
**Scope:** Trainer **Unified calendar** (`TrainerUnifiedCalendarView`, `/api/trainer/calendar/unified`)  
**Related:** `apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts`, `trainer-live-scheduled.ts`, `trainer-client-calendar.ts`

---

## 1. Problem & goals

### 1.1 Today (post P0–P2)

- The unified week grid uses **per-day columns**, sorted by time.
- **Scheduled live** cards: **Edit** drawer (P0), **Start session** / **Open live**, and **P2 drag** to another day (same local time on target date).
- **Coach instances:** **Edit** drawer (P1), live CTAs, **Open lab**, and **P2 drag** to another day.
- **Program** and **client-originated** rows remain **non-draggable**; UI copy treats them as read-only for reschedule unless product extends.

### 1.2 Goals

1. **Click** a scheduled session card → open a **session detail / edit** surface (drawer or modal).
2. **Edit** fields available per **current backend** contracts; extend schema/API where “name” or missing fields are required.
3. **Drag** (P2) onto **another day column** to **reschedule** — **same local time-of-day** in the viewer timezone on the target calendar date (**day snap**; vertical position does not change time). **Y-axis / intra-day time from drop position** is **out of scope** for P2 (future phase if product wants it). Optional later: **explicit sort** metadata if order ≠ time order.

---

## 2. Unified calendar item kinds (relevant subset)

| Kind | Source | Draggable flag (client calendar model) | Primary APIs |
|------|--------|----------------------------------------|--------------|
| `scheduled_live_occurrence` | `trainer_live_session_occurrences` | N/A in unified UI today | `PATCH /api/trainer/live-schedule/occurrences/[occurrenceId]`, `POST .../occurrences/[occurrenceId]/invites`, `PATCH /api/trainer/live-schedule/invites/[inviteId]` |
| `live_session` | `trainer_live_sessions` (runtime) | N/A | `PATCH /api/trainer/live-sessions/[sessionId]` (P1); navigate to `/live/:id` |
| `coach_instance` | `client_coach_schedule_instances` | `draggable: true` in `TrainerCalendarApiEvent` | `PATCH /api/trainer/clients/[userId]/calendar/instances/[instanceId]` |

**Resolved:** `live_session` rows require a **trainer edit drawer** in the unified calendar (not read-only). Runtime sessions are **thin** rows in DB (`shell`, `status`, `created_at`, `ended_at`, plus wrapper columns from later migrations); there is **no** calendar-specific display name on `trainer_live_sessions`—naming may come from a linked scheduled occurrence or future columns. **Mission Control–authenticated PATCH** under `pages/api/trainer/` is required for mutations (see §7).

---

## 3. Current edit capabilities (backend)

### 3.1 Scheduled live occurrence — `patchLiveScheduleOccurrence`

**Route:** `PATCH /api/trainer/live-schedule/occurrences/[occurrenceId]`  
**Server:** `patchLiveScheduleOccurrence` in `trainer-live-scheduled.ts`

| Field | Meaning |
|-------|---------|
| `scheduledStartAt` | ISO timestamptz |
| `scheduledEndAt` | ISO timestamptz |
| `status` | `scheduled` \| `cancelled` \| `completed` |
| `liveSessionId` | Link / unlink `trainer_live_sessions.id` (trainer-owned, active session) |
| `allowOverlap` | Bypass coach-schedule conflict check when `true` |
| `conflictExcludeScheduledOccurrenceIds` | Internal batch reschedule: extra occurrence ids ignored in overlap scan |

**Validations:** end after start; optional **scheduling conflict** detection via `findCoachScheduleConflictsForTrainer` (409 + `conflicts` payload — same pattern as create flow).

**Not supported today:** **display name / title** — table `trainer_live_session_occurrences` has **no `title` column** (see `20260406120100_trainer_live_scheduled_occurrences.sql`). UI label is fixed copy (“Scheduled Live”). **Recurrence** for a **series** is driven by `trainer_live_session_series` (weekly MVP); **per-occurrence** edits are **time window** and **status**; **apply to all future** updates series metadata and shifts future materialized rows (see §3.2).

### 3.2 Series — `patchLiveScheduleSeries` + future reschedule

**Route:** `PATCH /api/trainer/live-schedule/series/[seriesId]`  
**Patch:** `status` (`active` \| `cancelled`), `untilAt` (nullable), and **reschedule block** (optional):

- `rescheduleAnchorOccurrenceId` — occurrence belonging to this series (trainer-owned).
- `scheduledStartAt` / `scheduledEndAt` — new window for the anchor; **all scheduled occurrences in the series with `scheduled_start_at` ≥ anchor’s previous start** shift by the same UTC delta; series row `weekday`, `local_start_time`, `duration_minutes` are recomputed from the new anchor window for expand consistency.
- `allowOverlap` — bypass per-occurrence conflict checks when `true`.

**Effect (status cancel):** Cancelling series cancels **future** scheduled occurrences (see implementation).

### 3.3 Coach schedule instance

**Route:** `PATCH /api/trainer/clients/[userId]/calendar/instances/[instanceId]`  
**Patch:** `scheduledAt`, `assignmentId`, `trainerLiveSessionId`, `preflight`, `allowOverlap`

**Implications:**

- **Date/time:** `scheduledAt` (single ISO).
- **“Name”:** not a free-text field on the instance; **title** in the unified feed comes from the **assignment** (`title` on `TrainerCalendarApiEvent` for `coach_instance`). Changing **name** ⇒ change **`assignmentId`** to another assignment (same product rules as elsewhere), or add a **display override** (schema + API — not present today).

### 3.4 Runtime live session (P1)

**Route:** `PATCH /api/trainer/live-sessions/[sessionId]`  
Trainer-owned mutation surface for **ended** transition (sets `ended_at`), optional **shell** change while `active` where allowed by DB constraints, documented in route handler.

---

## 4. Product matrix: what “edit” means per kind

### 4.1 Minimum (stated requirement)

| User intent | `scheduled_live_occurrence` | `coach_instance` |
|-------------|----------------------------|------------------|
| Change **date** | `scheduledStartAt` / `scheduledEndAt` (preserve duration or edit both) | `scheduledAt` (date part in viewer TZ → ISO) |
| Change **time** | Same | Same |
| Change **name** | **Requires product + schema** (see §5) | **Assignment switch** or **new override column** |

### 4.2 Full edit surface based on **current** configuration

**Scheduled live occurrence**

- [x] Start / end (wall time, viewer timezone → UTC ISO for API).
- [x] Status: cancel / mark completed (if product allows).
- [x] Unlink / link live room (`liveSessionId`).
- [x] **Invite list management** — **in scope:** list, add roster clients (`POST .../occurrences/[id]/invites`), cancel pending/waitlisted (`PATCH .../invites/[inviteId]`).
- [x] **Series scope** — when `seriesId` present: **This occurrence only** (occurrence PATCH) vs **All future scheduled in this series** (series PATCH reschedule block).

**Coach instance**

- [x] Reschedule (`scheduledAt`).
- [x] Reassign workout (`assignmentId`) — drives **title** / metadata shown on card.
- [x] Link / unlink `trainerLiveSessionId`.
- [x] Conflict preflight / `allowOverlap` (existing).

**Live session (runtime row)**

- [x] **Trainer edit drawer** — end session, optional shell change, link to host room (`/live/:id`); fields bounded by `trainer_live_sessions` schema and RPC safety.

---

## 5. Gap: “Name” for scheduled live occurrences

**Today:** No persisted title; card shows **“Scheduled Live”** + optional `recurrenceSummary` from series.

**Options:**

1. **DB:** Add nullable `display_name text` (or `title`) on `trainer_live_session_occurrences` (+ migration, RLS unchanged pattern, extend `UnifiedScheduledLiveOccurrenceItem`, PATCH body).
2. **DB (series-level):** Add `display_name` on `trainer_live_session_series` for recurring labels; occurrences inherit or override — more product design.
3. **No schema:** “Name” only in client state (not recommended).

**Recommendation:** Add **`display_name`** (nullable) on **occurrences** for one-offs and per-occurrence overrides; series default name on **series** row in a later iteration if needed.

---

## 6. UX design

### 6.1 Click → open

- **Scheduled live card:** `onClick` opens **Session edit drawer** (or modal) keyed by `occurrenceId`.
- **Coach card:** open **Coach instance edit drawer** keyed by `clientUserId` + `instanceId`.
- **Live session card:** open **Live session edit drawer** keyed by `sessionId`.
- **Avoid** accidental open when clicking **Start session** — use **stopPropagation** on the button or separate **⋯ / Edit** affordance.

### 6.2 Edit drawer contents

- **Header:** type + client context (for coach: `clientLabel`).
- **Fields:** map to §3 / §4 (datetime pickers in **viewer timezone**, reuse `CalendarTimezoneControl` semantics).
- **Series:** Radio **This occurrence only** / **All future in this series** when `seriesId` is set; **All future** calls series PATCH reschedule (§3.2).
- **Actions:** Save, Cancel, **Cancel occurrence** (status `cancelled`).
- **Conflicts:** On 409, reuse **same conflict modal pattern** as `pendingLiveConflict` in `TrainerUnifiedCalendarView` (list + save anyway with `allowOverlap`).

### 6.3 Drag–reorder (P2) and accessibility

**Drag (P2) — shipped behavior:**

- **Scope:** Only **`scheduled_live_occurrence`** and **`coach_instance`** cards are draggable. **`program`**, **`scheduled_workout`**, **`amrap_scheduled`**, and **`live_session`** rows are not (unless product extends).
- **Drop semantics:** **Day column only.** `useDroppable({ id })` uses the column’s calendar id **`YYYY-MM-DD`**. On drop, **`reschedulePreservingViewerLocalTime`** (see `trainer-calendar-time.ts`) moves **start/end** (scheduled live) or **`scheduledAt`** (coach) to that date while preserving **hour/minute/second in the viewer timezone**. Dropping on the **same** day is a no-op.
- **Client mutations:** The view uses **`fetch`** to the same **PATCH** routes as the drawers (not a separate React helper named `patchCoachScheduleInstance` / `patchLiveScheduleOccurrence`). Server-side logic remains `patchCoachScheduleInstance` / `patchLiveScheduleOccurrence` in admin modules.
- **409 conflicts:** Same **`pendingLiveConflict`** modal as P0/P1; DnD uses modes **`patch_occurrence_dnd`** / **`patch_coach_dnd`** so **Save anyway** retries with **`allowOverlap: true`** without closing unrelated drawers.
- **UX:** **`DragOverlay`** shows a compact card clone; **`PointerSensor`** with **`activationConstraint: { distance: 8 }`**; **`onPointerDown` + `stopPropagation`** on **Edit**, **Start session** / **Open live**, and **Open lab** so clicks do not start drags.

**Dependencies (`apps/app/package.json`):** **`@dnd-kit/core`**, **`@dnd-kit/utilities`**, **`@dnd-kit/sortable`** (present). **`@dnd-kit/modifiers`** is **not** required for P2; add only if you introduce modifiers (e.g. `restrictToWindowEdges`).

**Accessibility (P0/P1 requirement unchanged):** **Non-pointer parity** for reschedule: datetime fields and keyboard-reachable controls in drawers; drag does **not** replace form-based reschedule.

**Not in P2:** **Optimistic UI** with rollback; **Y-axis time** from drop position; **keyboard drag** (`KeyboardSensor`) — optional follow-ups.

**Later:** Persist **custom order** per day → migration + `display_order` — only if product requires order ≠ time order.

---

## 7. API & server changes summary

| Work item | Status |
|-----------|--------|
| Occurrence PATCH | Existing |
| **POST** `.../occurrences/[occurrenceId]/invites` | Add roster invitees to existing occurrence |
| **PATCH** `.../live-schedule/invites/[inviteId]` | Cancel invite (trainer-owned occurrence) |
| Series PATCH reschedule block | Shift future occurrences + update series meta |
| Coach instance PATCH | Existing |
| **P2** DnD reschedule (unified view) | Same occurrence / coach PATCH routes + shared 409 modal (`patch_*_dnd` modes); no new API |
| **PATCH** `.../live-sessions/[sessionId]` | Runtime session (end / shell per policy) |
| `display_name` on occurrences | Optional (P3) |
| Conflict scan | `excludeScheduledOccurrenceIds` for batch series reschedule |
| Unified list refresh | After mutations: `loadUnified()` |

---

## 8. Frontend architecture

| Layer | Responsibility |
|-------|----------------|
| `TrainerUnifiedCalendarView` | Wire `onCardClick`, mount drawer(s), pass `viewerTimezone`, refetch; **P2:** `DndContext`, `applyDropFromDnD`, conflict retry |
| `UnifiedScheduledLiveEditDrawer` | Form + PATCH occurrence + invites + series scope + conflict modal |
| `UnifiedCoachInstanceEditDrawer` | Form + PATCH instance + assignment fetch |
| `UnifiedLiveSessionEditDrawer` | PATCH live session + link to host |
| `UnifiedCalendarDayColumn` | P2: `useDroppable({ id: date })` on column body + `isOver` styling |
| `UnifiedCalendarDraggableCard` | P2: `useDraggable` + listeners on card shell |
| `unified-calendar-dnd-types.ts` | P2: `UnifiedCalendarDragData` for draggable payloads |

**State:** Keep edits server-authoritative; avoid duplicating full `UnifiedCalendarItem` in local state except form drafts.

---

## 9. Security & auth

- Reuse **Mission Control** auth (`missionControlApiAuthHeaders`, `verifyRosterAccessRequest`) — enforced on PATCH/POST routes.
- Trainer can only mutate **own** occurrences, **own** invites on those occurrences, **own** series, **own** live sessions, and **roster** clients’ coach instances.

---

## 10. Testing

- Unit: timezone conversion helpers (start/end preservation).
- Integration: PATCH success, 409 conflict path, `allowOverlap` retry, series batch reschedule.
- **P2 manual:** drag scheduled live + coach cards across columns; confirm refetch and DB times; force overlap → conflict modal → **Save anyway** with `allowOverlap: true`.
- E2E (optional): open drawer → change time → save → card updates after refetch.

---

## 11. Phasing

### P0 — Scheduled live (shipped target)

- Click **scheduled live** card → **UnifiedScheduledLiveEditDrawer** (focus trap, keyboard-friendly).
- Edit start/end, status, link/unlink `liveSessionId`; **409** conflict UI with **Save anyway** (`allowOverlap`).
- **Invites:** list from unified payload; add clients (`POST .../invites`); cancel pending/waitlisted (`PATCH .../invites/[id]`).
- **Series:** **This occurrence only** vs **All future** → occurrence PATCH vs series PATCH reschedule block.
- **No drag** in P0.

### P1 — Coach instances + runtime live sessions

- **UnifiedCoachInstanceEditDrawer:** `scheduledAt`, assignment picker (`GET .../clients/[userId]/assignments`), `trainerLiveSessionId` clear/set, conflicts.
- **UnifiedLiveSessionEditDrawer:** `PATCH .../live-sessions/[sessionId]` (e.g. end session, shell where allowed), **Open live** link.

### P2 — Drag–drop day reschedule (**shipped**)

- **`@dnd-kit/core`** week grid: droppable day columns, draggable scheduled live + coach cards, overlay.
- **PATCH** via `fetch` to existing occurrence / coach instance routes; **409** → shared modal → **`allowOverlap: true`** retry.

### P3+

| Phase | Deliverable |
|-------|-------------|
| **P3** | `display_name` (or series title) + API |
| **P4** | Deeper series edits (interval weeks, timezone-only changes) if needed beyond reschedule block |
| **Future** | Optional **Y-axis / time-slot** drop within a column; optimistic UI; keyboard DnD |

---

## 12. Resolved decisions (formerly open questions)

1. **`live_session` cards:** **Full trainer-facing edit** from the unified calendar via drawer + **`PATCH /api/trainer/live-sessions/[sessionId]`** (see §3.4, §7). Calendar “name” for runtime rows is not a first-class column; use navigation and session fields that exist today.

2. **Series-linked occurrences:** Edit flow includes **This occurrence only** (occurrence PATCH) and **Apply to all future** (series PATCH with anchor + new window + delta shift for materialized rows).

3. **Invite editing in-drawer:** **In scope** for scheduled live (list, add roster invitees, cancel where allowed). Implemented via dedicated trainer invite routes (§7).

4. **Accessibility:** **Required** non-pointer paths (datetime fields, focusable controls). P2 drag is **pointer-primary** day-column reschedule only; it does not replace form-based reschedule.

5. **P2 drop model:** **Day snap** (preserve local time-of-day on target date). **Not** “drag to a different hour via vertical position” unless a future phase adds it.

---

## 13. References (code)

- Unified types: `apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts`
- Scheduled occurrence + series: `apps/app/src/lib/supabase/admin/trainer-live-scheduled.ts`
- Coach instance PATCH (server): `apps/app/src/lib/supabase/admin/trainer-client-calendar.ts` (`findCoachScheduleConflictsForTrainer`, `patchCoachScheduleInstance`)
- UI: `apps/app/src/components/react/trainer/views/TrainerUnifiedCalendarView.tsx`
- P2 DnD: `UnifiedCalendarDayColumn.tsx`, `UnifiedCalendarDraggableCard.tsx`, `unified-calendar-dnd-types.ts` (same `views` folder)
- Drawers: `apps/app/src/components/react/trainer/views/UnifiedScheduledLiveEditDrawer.tsx`, `UnifiedCoachInstanceEditDrawer.tsx`, `UnifiedLiveSessionEditDrawer.tsx`
- Schema: `supabase/migrations/20260406120100_trainer_live_scheduled_occurrences.sql`, `20260406140000_trainer_live_schedule_p1_series.sql`
