# HUD Timeline (Schedule Zone Calendar) — SWOT Analysis

**Scope:** Timeline / calendar in the HUD Schedule Zone — shows which days have workouts and workout state (status). Build-out context: continued hub work.

**Components:** `AppCalendar`, `UpcomingStrip`, `ScheduleZone`, `getCalendarEventsForRange`, `getLoggedDatesForCalendar`, `WorkoutEventDrawer`

**Date:** March 2025

---

## Overview

The Timeline is the calendar view in the HUD Schedule Zone. It displays:
- **AppCalendar:** Month grid with days; each day lists workouts (up to 3 visible, "+N more" if overflow) with status styling (scheduled / completed / missed).
- **UpcomingStrip:** Next 7 days as horizontal chips; workout title or "Rest"; click opens drawer or rest-day message.
- **WorkoutEventDrawer:** Day-detail drawer with workout info, Start Workout, View Log.

Data flows from `user_workout_logs` (completion) and `getProgramWithSchedule` (program structure). AMRAP scheduled sessions appear in a separate list below the strip.

---

## Strengths

| Area | Description |
|------|-------------|
| **Clear status differentiation** | Three states (scheduled, completed, missed) with distinct colors: orange (scheduled), emerald (completed), gray (missed). At-a-glance accountability. |
| **Month + 7-day strip** | Month view for planning; strip for immediate next week. Good balance of context and focus. |
| **Completion integration** | `getLoggedDatesForCalendar` maps `user_workout_logs` (program_id, week_id, workout_id, date) to event keys. Calendar accurately reflects what’s done. |
| **Program-aware** | Events include programId, programTitle, workoutTitle, weekId, workoutId — supports WorkoutPlayer launch and View Log scroll-to-history. |
| **Rest-day handling** | Empty days show "Rest"; click gives "Rest day — focus on recovery." Message. |
| **Drawer → WorkoutPlayer flow** | Click event → drawer → Start Workout → WorkoutPlayer. Tight loop for starting a workout. |
| **RefreshKey coordination** | `refreshKey` from parent triggers refetch; supports post–Sync to Calendar updates. |
| **Today highlighting** | UpcomingStrip highlights today’s chip (orange border/background). |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **No workout-level intensity** | CalendarEvent has no intensity (1–5 or easy/medium/hard). Program difficulty exists at program level; workout-level intensity not surfaced. Users cannot see “hard vs easy day” at a glance. |
| **AMRAP sessions separate** | AMRAP scheduled sessions live in a list below the strip, not on the calendar grid. Two separate UIs for program vs AMRAP. |
| **Consecutive-day model only** | `getCalendarEventsForRange` maps Week N Day M → startDate + globalDayOffset (consecutive days). No rest-day slots in schedule; every program day is a workout day. |
| **Single event per strip day** | UpcomingStrip shows one event per day (active program preferred). Multiple programs on same day collapse to one. |
| **No drag/reschedule** | Calendar is read-only. No drag-to-reschedule or inline date change. |
| **Truncation** | Day cells show up to 3 events; "+N more" for overflow. No expand-in-place or drill-down. |
| **No calendar export** | Sync to Calendar exists elsewhere; Timeline itself does not show sync status or export controls. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **Add intensity to events** | Extend CalendarEvent with `intensity?: 1..5` or `difficulty?: 'beginner'|'intermediate'|'advanced'`. Source from program difficulty or per-workout metadata (if added to schedule). Render as intensity bars or color gradient in day cells. |
| **Integrate AMRAP on grid** | Merge AMRAP scheduled sessions into the month view and UpcomingStrip. Same day cell, mixed event types (program workout + AMRAP). Requires shared `CalendarEvent` shape or union type. |
| **Visual intensity scale** | Use background opacity, border weight, or small intensity bars in day cells to show “easy vs hard” before click. |
| **Week view option** | Add week view (7 days, more detail per day) for users who plan week-by-week. |
| **Drag-to-reschedule** | Allow drag-and-drop of workouts to new dates (with validation against program structure or as ad-hoc moves). |
| **Rest day in schedule** | Extend program schedule to support explicit rest days (e.g. Day 4 = Rest) so Timeline shows planned rest, not just “no workout.” |
| **Multi-program day** | When multiple programs have workouts on same day, show both in strip/cell (e.g. stacked chips or comma-separated) instead of picking one. |

---

## Threats

| Area | Description |
|------|-------------|
| **user_workout_logs schema lock-in** | Completion key is `programId:weekId:workoutId`. Any change to program structure (weeks, workout IDs) can desync completion state. Migrations must preserve keys or provide backfill. |
| **Program start date semantics** | `startDate` drives all date math. Wrong or changed startDate shifts entire calendar. No validation that startDate is in the past or consistent with user expectations. |
| **Consecutive-day assumption** | Programs that use non-consecutive days (e.g. Mon/Wed/Fri) would need different mapping. Current logic assumes Day 1, Day 2, Day 3… are consecutive calendar days. |
| **AMRAP timezone** | AMRAP `scheduled_start_at` is ISO; display uses `toLocaleString`. Timezone mismatches can show wrong day or time. |
| **Performance at scale** | Many programs × many weeks × large date range could produce many events. No pagination or lazy loading for far-future months. |

---

## Architecture Summary

```
ScheduleZone (refreshKey, onViewLog)
  ├── AppCalendar (events, onEventClick, onMonthChange)
  │     └── Month grid: days with CalendarEvent[] per date
  │           status → STATUS_STYLES (scheduled | completed | missed)
  ├── UpcomingStrip (days, todayISO, onDayClick)
  │     └── 7 chips: date, event or Rest
  ├── AMRAP sessions list (separate, below strip)
  └── WorkoutEventDrawer (event, onStartWorkout, onViewLog)
```

**CalendarEvent:** `date`, `programId`, `programTitle`, `weekNumber`, `workoutTitle`, `workoutIndex`, `workoutId`, `weekId`, `status`

**Data:** `getCalendarEventsForRange(rangeStart, rangeEnd, programs, loggedMap)` + `getLoggedDatesForCalendar(userId, rangeStart, rangeEnd)`

---

## Recommendations for HUD Build-Out

1. **Add intensity to CalendarEvent** — Derive from program difficulty (beginner→1–2, intermediate→3, advanced→4–5) or add per-workout intensity to schedule. Extend `getCalendarEventsForRange` and AppCalendar rendering.
2. **Surface intensity in UI** — Use subtle intensity indicator (e.g. 1–5 dots or color gradient) in day cells so users see “hard vs easy” without opening the drawer.
3. **Unify AMRAP with calendar grid** — Represent AMRAP sessions as events on the correct dates. Shared event type or adapter; single source of truth for “what’s on this day.”
4. **Bump refreshKey on AMRAP schedule** — When AmrapScheduleModal or HistoryZone creates a session, increment `calendarRefreshKey` so ScheduleZone refetches and new AMRAP sessions appear promptly.
5. **Document consecutive-day assumption** — Add comment or doc: program schedule maps to consecutive calendar days. If non-consecutive scheduling is needed, plan a separate mapping layer.
