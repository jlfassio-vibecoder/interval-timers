# Phase 5.3: Drag-and-Drop Rescheduling — Implementation Plan

**Status:** Plan only (no implementation).  
**Roadmap ref:** [PHASE_5_ADVANCED_CALENDAR_ROADMAP.md](./PHASE_5_ADVANCED_CALENDAR_ROADMAP.md) § Phase 5.3.

**Goal:** User can drag schedulable events to a new date; backend and calendar stay in sync.

---

## 1. Draggable event types

| Type               | Draggable? | Backend update |
|--------------------|------------|----------------|
| `program`          | Yes (scheduled or missed) | Shift `user_programs.start_date` or per-workout override (see §2.3) |
| `amrap_scheduled`  | Yes       | `amrap_sessions.scheduled_start_at` |
| `timer_scheduled`  | Yes       | `scheduled_workouts.scheduled_at` |
| `timer` (completed)| No        | Read-only log |
| `amrap` (completed)| No        | Read-only result |
| `readiness`        | No        | Read-only |

**Scope:** Only **schedulable** events are draggable: `program`, `amrap_scheduled`, `timer_scheduled`. Completed/history types are excluded.

---

## 2. Backend / client API

### 2.1 Timer scheduled

- **Table:** `scheduled_workouts` (existing).
- **Gap:** No update-by-id today; only insert and delete.
- **Add:** In `apps/app/src/lib/supabase/client/scheduled-workouts.ts`:
  - `updateScheduledWorkout(id: string, updates: { scheduledAt: string }): Promise<void>`
  - Supabase: `.update({ scheduled_at: updates.scheduledAt }).eq('id', id)`.
- **RLS:** Existing policy (user can update own rows) is sufficient.

### 2.2 AMRAP scheduled

- **Table:** `amrap_sessions`; column `scheduled_start_at`.
- **Existing RPC:** `reschedule_session(p_session_id uuid, p_host_token text, p_scheduled_start_at timestamptz)` (migration `20250309000000_amrap_delete_reschedule.sql`). Requires `host_token`.
- **Options:**
  - **A)** Use `reschedule_session` with `host_token` from sessionStorage. Key: `amrap_friends_host_token_${sessionId}` (matches `SESSION_STORAGE_KEYS.hostToken` in `amrap-create-session.ts`; set when user creates session via `createAmrapSession`). If token missing (e.g. cleared storage, different device), show error: “Reschedule from the device where you created this session” or “Open session to reschedule.”
  - **B)** Add RPC `update_amrap_scheduled_for_user(p_session_id uuid, p_scheduled_start_at timestamptz)` that updates `scheduled_start_at` where `id = p_session_id` and `created_by_user_id = auth.uid()`. No host_token needed; works for creator only.
- **Recommendation:** Implement **A** first (client calls `reschedule_session` with stored host_token); add **B** in a follow-up if we want reschedule without host_token for creators.

**Client:** New module or extend `amrap-scheduled-sessions.ts` / `amrap-create-session.ts`:
- `rescheduleAmrapSession(sessionId: string, newScheduledAt: string): Promise<void>`
  - Read `sessionStorage.getItem(\`amrap_friends_host_token_${sessionId}\`)`.
  - If missing, throw with a clear message.
  - Call `supabase.rpc('reschedule_session', { p_session_id: sessionId, p_host_token: token, p_scheduled_start_at: newScheduledAt })`.

### 2.3 Program workouts

**Decision:** Include program drag in 5.3 (requires override table + merge logic) or defer to a later phase (implement only `amrap_scheduled` + `timer_scheduled`).

- **Current model:** Program date = `user_programs.start_date` + schedule offset (consecutive days). No per-workout date stored.
- **Options:**
  - **Shift start date:** Changing `start_date` moves the entire program. Dragging one workout would require recomputing a new start_date such that that workout lands on the drop date (possible but affects all other workouts).
  - **Per-workout override:** New table or JSONB: e.g. `user_program_workout_overrides (user_id, program_id, week_id, workout_id, override_date)`. When building calendar events, if an override exists for (program, week, workout), use `override_date` instead of the date from start_date + offset.
- **Recommendation for 5.3:** Implement **per-workout override** so “move this workout” only changes that day. Requires:
  - Migration: add table (or column on `user_programs`) for overrides; suggest table `user_program_workout_overrides (user_id, program_id, week_id, workout_id, override_date date, primary key (user_id, program_id, week_id, workout_id))` with RLS (user can CRUD own rows).
  - **Override merge flow:** New client `getProgramWorkoutOverrides(uid)` (or similar) fetches overrides for the range. `getCalendarEventsForRange` accepts optional `overrides: Map<string, string>` (key = `programId:weekId:workoutId`, value = override_date). `getUnifiedCalendarEvents` fetches overrides and passes them into the program event builder so that (programId, weekId, workoutId) uses `override_date` when present.
  - Client: `user-programs.ts` (or new `user-program-overrides.ts`): `setProgramWorkoutOverride(uid, programId, weekId, workoutId, date: string | null)` — null means “use default from start_date”.

**Alternative (narrower 5.3):** Omit program drag in 5.3; only implement drag for `amrap_scheduled` and `timer_scheduled`. Add program overrides in a later phase. Plan below assumes all three are in scope; if we defer program, we only do §2.1, §2.2 and the corresponding drag handling in §3.

---

## 3. Frontend: library and integration

- **Library:** Use **@dnd-kit/core** (and optionally **@dnd-kit/sortable** if we need reorder later). Good touch support, accessible, and works well with React. Install: `@dnd-kit/core`, `@dnd-kit/utilities`.
- **Drag source:** Each **draggable event** in the calendar grid. Today each day cell is one button (either “N activities” or one event title). To support drag:
  - Render **per-event pills** inside each day cell (not only the first or “N activities”). Each pill is a draggable item when type is `program` / `amrap_scheduled` / `timer_scheduled`.
  - Use a stable drag `id` derived from event (e.g. `program:${programId}:${weekId}:${workoutId}` | `amrap_scheduled:${sessionId}` | `timer_scheduled:${sessionId}` — for timer_scheduled, `sessionId` is the `scheduled_workouts.id`). Drag data must hold the event (or at least `{ type, sessionId, programId?, weekId?, workoutId?, metadata? }`) so the drop handler can call the correct API without re-fetching.
- **Drop target:** Each **day cell** is a droppable zone (accept only draggable types above). Drop = “move this event to this date.”
- **Callback contract:** AppCalendar needs a new prop **`onEventDrop?: (event: CalendarEvent, targetDate: string) => Promise<void>`**. ScheduleZone implements this callback: it calls the appropriate API (updateScheduledWorkout / rescheduleAmrapSession / setProgramWorkoutOverride), then calls `onCalendarRefresh()`. AppCalendar invokes `onEventDrop` from its `onDragEnd` handler (it does not need `userId`; the parent owns API calls).
- **Flow:** On drop:
  - Resolve event type and target date (ISO). Call `onEventDrop(event, targetDate)`.
  - **Time-of-day preservation:** For `amrap_scheduled` and `timer_scheduled`, `scheduled_at` is timestamptz. Construct new value as `targetDate + "T" + timePart` (e.g. extract time from `metadata.scheduledAt` for timer_scheduled, or from the session for amrap_scheduled). Fallback: `targetDate + "T12:00:00Z"` if original has no time.
  - On success: parent calls `onCalendarRefresh()` (or dispatches `calendar:refresh`) so ScheduleZone refetches; optionally optimistic UI update.
- **Rendering:** Render one draggable pill per event (replacing the current single "N activities" button when multiple events exist) so each event can be dragged. Day click to open drawer remains; click and drag are distinct interactions.
- **Files to touch:**
  - `AppCalendar.tsx`: Wrap grid in `DndContext`; add `onEventDrop` prop; make day cells `useDroppable`; render event pills with `useDraggable`. Handle `onDragEnd` → resolve drop target date and event, call `onEventDrop(event, targetDate)`.

---

## 4. UX and a11y

- **Error handling:** On API failure, show a toast (or inline message); do not optimistically update UI. Optimistic update with revert on error is out of scope for MVP.
- **Ghost / preview:** Use `DragOverlay` (@dnd-kit) to show a clone of the dragged event (title + type styling) while dragging.
- **Drop target highlight:** When dragging over a valid day cell, add a clear visual state (e.g. ring, background tint) so the user sees where the event will land.
- **Touch:** @dnd-kit supports pointer and touch; ensure drag threshold is comfortable on mobile (defaults usually fine).
- **Keyboard:** Optional for 5.3: “Move to date” in drawer (date picker) as an alternative to drag. If we add it, same backend APIs apply.
- **ARIA:** Use `aria-describedby` / labels so screen readers know the control is draggable and which date it will drop on when over a cell.

---

## 5. Files to add or change (summary)

| Area | File(s) | Change |
|------|--------|--------|
| Timer scheduled | `apps/app/src/lib/supabase/client/scheduled-workouts.ts` | Add `updateScheduledWorkout(id, { scheduledAt })`. |
| AMRAP scheduled | New or existing client (e.g. `amrap-reschedule.ts` or `amrap-scheduled-sessions.ts`) | Add `rescheduleAmrapSession(sessionId, newScheduledAt)` using `reschedule_session` RPC + sessionStorage host_token. |
| Program (if in scope) | New migration | Table (or column) for `user_program_workout_overrides`. |
| Program (if in scope) | `apps/app/src/lib/supabase/client/user-programs.ts` or new `user-program-overrides.ts` | `setProgramWorkoutOverride(uid, programId, weekId, workoutId, date \| null)`. |
| Program (if in scope) | `getCalendarEventsForRange` / unified | When building program events, apply overrides so that overridden (programId, weekId, workoutId) use override_date. |
| Calendar UI | `apps/app/src/components/react/hud/AppCalendar.tsx` | Add `onEventDrop` prop; integrate @dnd-kit: DndContext, droppable day cells, draggable event pills, DragOverlay; onDragEnd → call `onEventDrop(event, targetDate)`; parent triggers refresh. |
| Calendar UI | `ScheduleZone.tsx` | Implement `onEventDrop` handler (calls updateScheduledWorkout / rescheduleAmrapSession / setProgramWorkoutOverride, then `onCalendarRefresh()`); pass handler to AppCalendar. |
| Types | `CalendarEvent` | Already has `type`, `sessionId`, `metadata.logId` etc.; ensure drag payload can be built from it. |

---

## 6. Order of implementation (suggested)

1. **Backend / client APIs**
   - Add `updateScheduledWorkout` in `scheduled-workouts.ts`.
   - Add `rescheduleAmrapSession` (and optionally `update_amrap_scheduled_for_user` RPC if we prefer creator-based reschedule).
   - If doing program: migration + `setProgramWorkoutOverride` + merge overrides into calendar event build.
2. **Calendar drag-and-drop**
   - Install @dnd-kit; wrap `AppCalendar` in `DndContext`.
   - Add `onEventDrop` prop to AppCalendar; ScheduleZone provides the handler (API calls + `onCalendarRefresh`).
   - Make each day cell a droppable; render draggable event pills for `program` / `amrap_scheduled` / `timer_scheduled`.
   - On drop: map event type → API call (updateScheduledWorkout / rescheduleAmrapSession / setProgramWorkoutOverride), then trigger calendar refresh.
3. **Polish**
   - DragOverlay with event preview; drop target highlight; touch and a11y tweaks.

---

## 7. Out of scope for 5.3

- Reordering within the same day (e.g. sort order).
- Changing time-of-day via drag (e.g. time slots); only date change.
- Drag from drawer or from a list outside the calendar (only drag from calendar grid in this phase).

**Note:** The roadmap (§5.3) mentions "scheduled_workouts / calendar_events"; implementation uses the `scheduled_workouts` table only. "Calendar events" there refers to the logical concept (events on the calendar), not a separate table.
