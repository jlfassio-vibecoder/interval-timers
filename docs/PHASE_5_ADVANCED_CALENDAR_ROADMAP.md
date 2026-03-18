# Phase 5: Advanced Calendar Features — Phased Roadmap

**Parent:** [Calendar Unified Tracking Plan](CALENDAR_UNIFIED_TRACKING_PLAN.md) Phase 5

**Goal:** Rich calendar interactions, scheduling, insights, and power-user features. This document expands Phase 5 into sub-phases so features can be shipped incrementally.

---

## Overview

| Sub-phase | Focus | Effort | Dependencies |
|-----------|-------|--------|---------------|
| **5.1** | Schedule workouts from calendar | Medium | None |
| **5.2** | Suggested times when scheduling | Low | 5.1 |
| **5.3** | Drag-and-drop rescheduling | Medium | 5.1 (for timer scheduled) |
| **5.4** | Calendar export (.ics) | Medium | None |
| **5.5** | Activity insights (tooltip, weekly summary) | Low | None |
| **5.6** | Rest-day blocking | Low | None |
| **5.7** | Multi-select actions | Medium | None |
| **5.8** | Week view / list view | Medium | None |
| **5.9** | Priority order for same-day events | Low | None |
| **5.10** | Program + ad-hoc balance summary | Low | None |
| **5.11** | Recurring scheduled workouts | High | 5.1 |
| **5.12** | Notifications / reminders | Medium-High | 5.1, notification infra |

---

## Phase 5.1: Schedule Workouts from Calendar

**Effort:** Medium (2–3 days)  
**Risk:** Medium (new modal, data model for timer scheduling)

### Goal
User can schedule any interval workout from the calendar via a single modal, similar to AmrapScheduleModal.

### Changes

1. **Trigger:**
   - Tap empty day cell → show option to "Schedule workout" (or open modal directly)
   - On days with events: "+" or "Schedule" affordance opens modal with date pre-filled
   - Optional: Schedule button in calendar header or UpcomingStrip

2. **Schedule Workout modal:**
   - **Workout type selector:** AMRAP With Friends, Tabata, Daily Warm-Up, and other timer/interval apps from app registry that support scheduling (curated list or configurable)
   - **Date and time** picker
   - **Type-specific options:**
     - AMRAP: duration, workout list (or "from template" if scheduling without prior result)
     - Timer apps: optional label, duration hint, or preset name
   - Reuse date/time picker pattern from AmrapScheduleModal

3. **Backend / data:**
   - **AMRAP:** Existing `amrap_sessions` + `createAmrapSession`; for "schedule from scratch" may need `createAmrapSession` variant or template support
   - **Timer apps:** New `scheduled_workouts` table or `calendar_events` with `event_type`, `source_app`, `scheduled_at`, optional `config` jsonb

4. **Calendar display:**
   - Scheduled timer events appear as new `timer_scheduled` (or similar) type; calendar-unified fetches and merges
   - "Do" action on day links to app; completion writes to `workout_logs` via existing handoff

### Deliverable
User taps empty day (or Schedule) → picks workout type and date/time → sees scheduled event on calendar.

---

## Phase 5.2: Suggested Times When Scheduling

**Effort:** Low (< 1 day)  
**Risk:** Low

### Goal
When scheduling, suggest "typical" times based on past completions for that workout type.

### Changes
- Query `workout_logs` and `shared.amrap_session_results` for completed sessions by source/type
- Derive most common time of day (e.g. 7:00 AM for Tabata)
- In Schedule modal, show "Usually at 7:00 AM" chip or pre-fill time input
- Optional: "Use suggested" button

### Dependencies
5.1 (Schedule modal must exist)

### Deliverable
Schedule modal shows suggested time based on past behavior.

---

## Phase 5.3: Drag-and-Drop Rescheduling

**Effort:** Medium (2–3 days)  
**Risk:** Medium (touch + mouse, program date semantics)

### Goal
User can drag events to a new date; backend updates accordingly.

### Changes
- **Program workouts:** Drag updates program logic—either `user_programs.startDate` shift or explicit "move this workout" (latter may need new field)
- **AMRAP scheduled:** Update `amrap_sessions.scheduled_start_at`
- **Timer scheduled:** Update `scheduled_at` in `scheduled_workouts` / `calendar_events`
- Use native HTML5 drag or a library (react-dnd, dnd-kit); ensure touch support for mobile
- Visual feedback: ghost/drag preview, drop target highlight

### Dependencies
5.1 for timer scheduled events

### Deliverable
Drag any schedulable event to new date; calendar and backend stay in sync.

---

## Phase 5.4: Calendar Export (.ics)

**Effort:** Medium (1–2 days)  
**Risk:** Low

### Goal
"Sync to Calendar" (or "Export") generates an `.ics` file with all scheduled and completed events for external calendar apps.

### Changes
- Button in HUD calendar header or ScheduleZone
- Fetch unified events for a configurable range (e.g. next 30 days + past 7)
- Generate `.ics` (RFC 5545) with:
  - Program workouts (scheduled, from program schedule)
  - AMRAP scheduled sessions
  - Scheduled timer workouts (from 5.1)
  - Optionally: completed events as read-only or with different styling
- Download file or open in default calendar app
- Support Google Calendar, Apple Calendar, Outlook (all consume .ics)

### Deliverable
User downloads .ics; imports into Google/Apple/Outlook; sees all scheduled workouts.

---

## Phase 5.5: Activity Insights

**Effort:** Low (1 day)  
**Risk:** Low

### Goal
Surfacing quick stats improves engagement and planning.

### Changes
- **Day tooltip (hover/tap):** "3 workouts, 90 min total, avg effort 7/10" — aggregate from events for that day
- **Weekly summary bar:** "This week: 5 workouts, 4h 20m, 3 PRs" — below calendar or in header
- Data from `workout_logs` (duration_seconds, effort), `user_workout_logs`, AMRAP results
- Optional: sparkline or mini-chart for the week

### Deliverable
Tooltip on day hover + weekly summary bar visible.

---

## Phase 5.6: Rest-Day Blocking

**Effort:** Low (< 1 day)  
**Risk:** Low

### Goal
User can mark a day as rest; calendar reflects it and optionally warns when scheduling on top.

### Changes
- New store: `user_rest_days` or `calendar_events` with `event_type: 'rest'` — `user_id`, `date`
- "Mark as rest" action: from empty day click, or from day context menu
- Calendar display: rest day styling (e.g. gray overlay, "Rest" label)
- When scheduling on a rest day: optional confirmation "You marked this as rest. Schedule anyway?"
- Optional: "Unmark rest" to revert

### Deliverable
User marks rest days; calendar shows them; optional warning when scheduling over rest.

---

## Phase 5.7: Multi-Select Actions

**Effort:** Medium (1–2 days)  
**Risk:** Low

### Goal
User can select multiple days and apply bulk actions.

### Changes
- Multi-select mode: long-press or checkbox mode to select days
- Actions:
  - **Mark as rest** (bulk rest days)
  - **Copy week** (copy one week's pattern to another)
  - **Clear scheduled** (remove scheduled workouts for selected days—with confirmation)
  - Future: bulk export, bulk schedule
- Selected days visual state; "Apply" or action bar at bottom

### Deliverable
Select multiple days → apply "Mark as rest" or "Copy week" (or other actions).

---

## Phase 5.8: Week View / List View

**Effort:** Medium (2 days)  
**Risk:** Low

### Goal
Power users can switch from month grid to week or list view.

### Changes
- View toggle: Month | Week | List (tabs or segmented control)
- **Week view:** Single week, larger cells, more detail per day (similar to UpcomingStrip but for 7 days with full content)
- **List view:** Chronological list of upcoming events (next 14–30 days), grouped by date, compact cards
- State: store view preference (localStorage or user prefs if available)
- Month view remains default

### Deliverable
User can switch to week or list view; preference persists.

---

## Phase 5.9: Priority Order for Same-Day Events

**Effort:** Low (< 1 day)  
**Risk:** Low

### Goal
User can set display/export order when a day has multiple events.

### Changes
- Settings or per-day override: "Show program first, then Tabata, then AMRAP"
- Store order preference: global default (e.g. program > amrap_scheduled > timer_scheduled > rest) or user-defined
- Apply in: MultiActivityDayDrawer, UpcomingStrip, .ics export, list view
- Optional: drag to reorder within MultiActivityDayDrawer for that day only

### Deliverable
Events on multi-activity days appear in user-defined order.

---

## Phase 5.10: Program + Ad-Hoc Balance Summary

**Effort:** Low (< 1 day)  
**Risk:** Low

### Goal
Weekly summary encourages program adherence by showing program vs ad-hoc split.

### Changes
- Compute for current week: program workouts completed, ad-hoc (timer, AMRAP) completed
- Display: "3 program + 2 ad-hoc" or "3/4 program workouts this week"
- Placement: near weekly summary bar (5.5) or in HUD header
- Optionally: target from program (e.g. "4 scheduled") vs completed

### Deliverable
Weekly summary includes program vs ad-hoc breakdown.

---

## Phase 5.11: Recurring Scheduled Workouts

**Effort:** High (3–4 days)  
**Risk:** Medium

### Goal
User can schedule recurring workouts (e.g. "Tabata every Tuesday 7am").

### Changes
- Data model: recurrence rule (RRULE or custom: frequency, weekday, time, end date)
- Store: `recurrence_rule` on `scheduled_workouts` / `calendar_events`, or separate `recurring_schedules` table
- UI: "Repeat" option in Schedule modal — weekly, select weekdays; optional end date
- Generation: expand recurrence into instances for calendar display (or generate on-the-fly for visible range)
- Edit/delete: "This occurrence" vs "All future" when editing or cancelling
- Export: .ics supports RRULE for recurring events

### Dependencies
5.1 (Schedule modal and data model)

### Deliverable
User schedules "Tabata every Tuesday 7am"; calendar shows all instances; .ics includes recurrence.

---

## Phase 5.12: Notifications / Reminders

**Effort:** Medium–High (2–4 days)  
**Risk:** Medium (depends on notification infrastructure)

### Goal
Optional push or email reminder before scheduled sessions.

### Changes
- User preference: "Remind me 15/30/60 minutes before"
- Backend: scheduled job or edge function that checks `scheduled_at` and sends notification
- Requires: push (Web Push, or native) and/or email (Resend, SendGrid, etc.)
- Storage: `user_notification_preferences` — reminder offset, channels (push, email)
- Optional: in-app notification center for upcoming reminders

### Dependencies
5.1 (scheduled events must exist); notification service (push/email)

### Deliverable
User receives reminder before scheduled workout.

---

## Implementation Order (Suggested)

**Tier 1 — Core scheduling & export**
1. **5.1** Schedule workouts from calendar
2. **5.4** Calendar export (.ics)
3. **5.5** Activity insights

**Tier 2 — UX polish**
4. **5.2** Suggested times
5. **5.6** Rest-day blocking
6. **5.9** Priority order for same-day events
7. **5.10** Program + ad-hoc balance

**Tier 3 — Power features**
8. **5.3** Drag-and-drop rescheduling
9. **5.7** Multi-select actions
10. **5.8** Week / list view

**Tier 4 — Advanced**
11. **5.11** Recurring scheduled workouts
12. **5.12** Notifications / reminders

---

## Data Model (Phase 5 Summary)

| Table | Phase | Purpose |
|-------|-------|---------|
| `scheduled_workouts` | 5.1 | Timer/interval scheduled events (`user_id`, `source_app`, `scheduled_at`, `config`?, `recurrence_rule`? for 5.11) |
| `calendar_events` | 5.1 optional | Unified polymorphic events; alternative to `scheduled_workouts` |
| `user_rest_days` | 5.6 | Rest-day markers (`user_id`, `date`) |
| `user_notification_preferences` | 5.12 | Reminder offset, channels |
| `user_event_order_preference` | 5.9 | Default display order for event types |

---

## Files to Create/Modify (Phase 5)

| File | Phase | Change |
|------|-------|--------|
| `ScheduleWorkoutModal.tsx` | 5.1 | New modal component |
| `AppCalendar.tsx` | 5.1, 5.3, 5.6, 5.7, 5.8 | Schedule trigger, drag-drop, rest styling, multi-select, view toggle |
| `ScheduleZone.tsx` | 5.1 | Integrate ScheduleWorkoutModal; pass date from day click |
| `calendar-unified.ts` | 5.1 | Fetch scheduled timer events; merge into unified events |
| `scheduled-workouts.ts` (client) | 5.1 | CRUD for scheduled timer workouts |
| `ics-export.ts` | 5.4 | Generate .ics from unified events |
| `AmrapScheduleModal.tsx` | 5.2 | Suggested time chip (or extend ScheduleWorkoutModal) |
| Migration: `scheduled_workouts` | 5.1 | New table |
| Migration: `user_rest_days` | 5.6 | New table |
| Migration: `user_notification_preferences` | 5.12 | New table |
