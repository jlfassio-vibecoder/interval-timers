# Calendar as Central Activity Tracking — Phased Implementation Plan

**Goal:** Make the HUD calendar the single source of truth for all user physical activity across all apps (Programs, AMRAP With Friends, Tabata, Daily Warm-Up, and 10+ other timer apps).

**Current state:** Calendar shows only **program workouts** (from `user_workout_logs` via WorkoutPlayer). AMRAP sessions appear in a separate list below the calendar. Timer app sessions (Tabata, Daily Warm-Up, etc.) are logged to `workout_logs` but not shown on the calendar.

---

## Data Sources Today

| Source | Table | Current Calendar Integration | Notes |
|--------|-------|------------------------------|-------|
| **Program workouts** | `user_workout_logs` | ✅ Calendar events + completion markers | Set-level logs from WorkoutPlayer; drives calendar, heatmap, volume chart, PRs |
| **AMRAP With Friends** | `shared.amrap_session_results` | ❌ Separate list below calendar | Results via RPC; shown in HistoryZone and AmrapProgressSection |
| **Timer apps** (Tabata, Daily Warm-Up, etc.) | `workout_logs` (with `source` field) | ❌ Not shown on calendar | Handoff flow saves summary logs (effort, rating, duration, source); shown in AccountFeed but not calendar |
| **Readiness check-in** | `workout_logs` (`workout_name='Readiness'`) | ❌ Not shown on calendar | TodayZone only; special row hack |
| **AMRAP scheduled sessions** | `amrap_sessions` | ⚠️ Separate list below calendar | Future events; not integrated into calendar grid |

---

## Phase 1: Unified Calendar Event Model

### Goal
Extend `CalendarEvent` to support all activity types (program, AMRAP, timer, readiness) with a single interface.

### Changes

1. **Extend `CalendarEvent` type** ([apps/app/src/lib/calendar-events.ts](apps/app/src/lib/calendar-events.ts)):
   - Add `type: 'program' | 'amrap' | 'timer' | 'readiness' | 'amrap_scheduled'`
   - Make program-specific fields optional: `programId?`, `weekId?`, `workoutId?`, `weekNumber?`
   - Add `sourceApp?: string` for timer apps (tabata, daily-warmup, etc.)
   - Add `sessionId?: string` for AMRAP sessions
   - Add `metadata?: { rounds?: number; durationSeconds?: number; effort?: number; rating?: number }`

2. **Create `getUnifiedCalendarEvents`** function:
   - Input: `userId`, `rangeStart`, `rangeEnd`
   - Fetch in parallel:
     - Program events (existing `getCalendarEventsForRange` logic)
     - AMRAP completed sessions from `shared.amrap_session_results` (via RPC)
     - AMRAP scheduled sessions from `amrap_sessions`
     - Timer app logs from `workout_logs` (where `source IS NOT NULL`)
     - Readiness check-ins from `workout_logs` (where `workout_name='Readiness'`)
   - Merge all into single `CalendarEvent[]` array, sorted by date
   - Handle multiple activities per day (array of events per date)

3. **Update `ScheduleZone`** to use `getUnifiedCalendarEvents`:
   - Replace separate `getCalendarEventsForRange` + `getAmrapScheduledSessionsForUser` calls
   - Pass unified events to `AppCalendar`
   - Remove separate AMRAP sessions list (now integrated)

4. **Update `AppCalendar`** to render multi-activity days:
   - When a date has multiple events, show indicator (e.g. "3 activities")
   - On click, show drawer with all events for that day
   - Color-code by type (program: orange, AMRAP: blue, timer: green, readiness: purple)

---

## Phase 2: Calendar Refresh Triggers

### Goal
Ensure calendar refetches when any activity is saved, scheduled, or completed.

### Changes

1. **Wire `onScheduled` callback in `HistoryZone`** ([apps/app/src/components/react/hud/HistoryZone.tsx](apps/app/src/components/react/hud/HistoryZone.tsx)):
   - Pass `onScheduled` to `AmrapScheduleModal` (currently not passed)
   - Callback should bump `calendarRefreshKey` in AppIslands
   - Flow: HistoryZone needs access to parent's refresh trigger (via prop or context)

2. **Add `onCalendarRefresh` prop to `HUDContent`**:
   - Pass from AppIslands: `onCalendarRefresh={() => setCalendarRefreshKey((k) => k + 1)}`
   - Thread through to HistoryZone
   - HistoryZone calls it when:
     - AmrapScheduleModal succeeds (`onScheduled`)
     - WorkoutPlayer completes (already calls `loadSessions`; also call `onCalendarRefresh`)

3. **Realtime triggers** (already implemented in Phase 0):
   - `useHUDRealtime` already bumps `calendarRefreshKey` on `onAmrapSessionsChange`
   - Extend to also bump on `workout_logs` changes (timer apps):
     - Add `workout_logs` subscription to `useHUDRealtime` (with `filter: user_id=eq.${userId}`)
     - On INSERT, bump `calendarRefreshKey`

4. **Timer app handoff**:
   - When `logHandoffSession` succeeds in AccountLanding, dispatch `CustomEvent('calendar:refresh')` or use AppContext callback
   - AppIslands listens and bumps `calendarRefreshKey`

---

## Phase 3: Multi-Day Event Drawer

### Goal
When user clicks a calendar day with multiple activities, show a unified drawer listing all events.

### Changes

1. **Create `MultiActivityDayDrawer`** component:
   - Props: `date: string`, `events: CalendarEvent[]`, `onClose`, `onEventClick`
   - Lists all activities for the day grouped by type
   - Each item shows: icon (by type), title, duration/rounds, status
   - Click opens type-specific detail drawer (WorkoutEventDrawer, AmrapResultDetailDrawer, or new TimerActivityDrawer)

2. **Update `AppCalendar`**:
   - When `eventsByDate.get(date).length > 1`, show multi-activity indicator
   - On click, open `MultiActivityDayDrawer` instead of single event drawer
   - When `length === 1`, keep current behavior (direct to detail drawer)

3. **Create `TimerActivityDrawer`**:
   - For timer app logs (Tabata, Daily Warm-Up, etc.)
   - Shows: workout name, duration, effort, rating, notes, source app
   - Actions: "Do Again" (navigate to timer app), "Edit" (update effort/rating/notes)

---

## Phase 4: Unified History Feed (Future)

### Goal
Merge HistoryZone's separate program/AMRAP feeds into single chronological list.

### Changes

1. **Extend `SessionFeed`** to support all activity types:
   - Accept `FeedItem[]` (already exists in AccountFeed) instead of `SessionHistoryItem[]`
   - Render cards with type-specific icons and metadata

2. **Update `HistoryZone`**:
   - Replace separate `sessions` (program) and `amrapResults` (AMRAP) state
   - Fetch all activity types via new `getUnifiedActivityHistory` function
   - Single filter bar applies to all types
   - Single feed with mixed cards

3. **Create `getUnifiedActivityHistory`**:
   - Parallel fetch: `user_workout_logs`, `shared.amrap_session_results`, `workout_logs` (timer apps)
   - Map to `FeedItem[]` with consistent shape
   - Sort by date desc, apply filter (all / this_week / this_month / by_program / by_type)

---

## Phase 5: Advanced Calendar Features

### Goal
Rich calendar interactions and insights, including scheduling any interval workout from the calendar.

### Changes

1. **Schedule workouts from calendar** *(NEW)*:
   - **Trigger:** From calendar, user can schedule a workout for a chosen day (e.g. tap empty cell or a “Schedule” / “+” affordance on a day).
   - **Modal:** A “Schedule workout” modal (pattern similar to `AmrapScheduleModal`) opens. User selects:
     - **Workout type:** Any schedulable interval (AMRAP With Friends, Tabata, Daily Warm-Up, and other timer/interval apps from the app registry that support scheduling).
     - **Date and time** for the scheduled session.
     - **Type-specific options** where applicable (e.g. AMRAP: duration, workout list; timer apps: optional preset or label).
   - **Behavior:**
     - **AMRAP:** Reuse/create session via existing `amrap_sessions` + `createAmrapSession` (same as current Schedule from result flow); appears as `amrap_scheduled` on calendar.
     - **Timer/interval apps (Tabata, Daily Warm-Up, etc.):** Store scheduled intent in a new or existing store (e.g. `scheduled_workouts` or Phase 5 `calendar_events` table) with `event_type`, `source_app`, `scheduled_at`, optional config. Calendar shows these as scheduled timer events; “Do” on the day links to the app (and completion can still write to `workout_logs` via handoff).
   - **UX:** Single modal to “schedule any interval” keeps the flow consistent; AMRAP and timer scheduling can share date/time picker and differ only in type selector and optional fields.

2. **Drag-and-drop rescheduling**:
   - Drag program workout to new date → update `user_programs.startDate` (recompute all dates)
   - Drag AMRAP session to new date → update `amrap_sessions.scheduled_start_at`
   - If Phase 5 adds scheduled timer events, drag those → update `scheduled_at` in store

3. **Calendar export**:
   - "Sync to Calendar" button generates `.ics` file with all scheduled events
   - Supports Google Calendar, Apple Calendar, Outlook

4. **Activity insights**:
   - Hover over day: tooltip with "3 workouts, 90 min total, avg effort 7/10"
   - Weekly summary bar: "This week: 5 workouts, 4h 20m, 3 PRs"

5. **Multi-select actions**:
   - Select multiple days → bulk actions (mark as rest day, copy week, etc.)

---

## Data Model Changes

### New or Extended Tables

| Table | Change | Reason |
|-------|--------|--------|
| `workout_logs` | Already has `source`, `duration_seconds`, `rounds`, `calories` | Timer apps use this; no change needed |
| `user_workout_logs` | No change | Program workouts; already on calendar |
| `shared.amrap_session_results` | No change | AMRAP results; Phase 1 integrates into calendar |
| `amrap_sessions` | No change | Scheduled AMRAP; Phase 1 integrates into calendar |
| **NEW: `calendar_events`** (optional, Phase 5) | Unified event table with polymorphic `event_type` and `event_data` jsonb | Simplifies queries; single source of truth; enables advanced features (drag-drop, export, **scheduled timer workouts**) |
| **NEW: `scheduled_workouts`** (Phase 5 alternative) | `user_id`, `source_app` (e.g. tabata, daily-warmup), `scheduled_at`, optional `config` jsonb | Lightweight store for “schedule Tabata/Daily Warm-Up/etc.” from calendar; calendar and export read from here until merged into `calendar_events` if desired |

---

## Architecture: Before vs After

### Before (Today)

```
ScheduleZone
  ├── AppCalendar (program events only)
  ├── UpcomingStrip (program events only)
  └── AMRAP sessions list (separate)

HistoryZone
  ├── SessionFeed (program sessions)
  └── AMRAP results list (separate)
```

### After (Phase 3)

```
ScheduleZone
  └── AppCalendar (unified: program + AMRAP + timer + readiness)
        ├── Day cell: multi-activity indicator
        └── Click → MultiActivityDayDrawer
              ├── Program events → WorkoutEventDrawer
              ├── AMRAP events → AmrapResultDetailDrawer
              └── Timer events → TimerActivityDrawer

HistoryZone
  └── UnifiedFeed (all activity types, single chronological list)
```

---

## Realtime Refresh (Already Implemented)

- `useHUDRealtime` subscribes to:
  - `user_workout_logs` → bumps `calendarRefreshKey` + `historyRefreshKey`
  - `shared.amrap_session_results` → bumps `historyRefreshKey`
  - `amrap_sessions` → bumps `calendarRefreshKey`
  - `amrap_participants` → bumps `calendarRefreshKey`
- **TODO Phase 2**: Add `workout_logs` subscription for timer app handoff

---

## Migration Path

### Phase 1 (Foundation)
- **Effort:** Medium (2-3 days)
- **Risk:** Low (additive; existing calendar still works)
- **Deliverable:** Calendar shows all activity types; multi-activity days have indicator

### Phase 2 (Refresh Triggers)
- **Effort:** Low (1 day)
- **Risk:** Low (wiring only)
- **Deliverable:** Calendar updates immediately when activity is saved/scheduled

### Phase 3 (Multi-Activity UX)
- **Effort:** Medium (2 days)
- **Risk:** Low (new components; existing flows unchanged)
- **Deliverable:** Click multi-activity day → drawer with all events; type-specific detail views

### Phase 4 (Unified History)
- **Effort:** Medium-High (3-4 days)
- **Risk:** Medium (replaces existing HistoryZone feed logic)
- **Deliverable:** Single chronological feed for all activity; unified filters

### Phase 5 (Advanced Features)
- **Effort:** High (5-7 days+)
- **Risk:** Medium-High (drag-drop, export, new table, schedule-from-calendar modal)
- **Deliverable:** See [PHASE_5_ADVANCED_CALENDAR_ROADMAP.md](PHASE_5_ADVANCED_CALENDAR_ROADMAP.md)

---

**Phase 5 detailed roadmap:** See [PHASE_5_ADVANCED_CALENDAR_ROADMAP.md](PHASE_5_ADVANCED_CALENDAR_ROADMAP.md) for sub-phases 5.1–5.12. Original options (now in roadmap):

- **Recurring scheduled workouts:** e.g. “Tabata every Tuesday 7am”; store recurrence rule and generate instances (or integrate with .ics / external calendar).
- **Suggested times:** When scheduling, suggest “typical” times based on past completions (e.g. “You usually do Tabata at 7:00”).
- **Week view / list view:** Toggle calendar to a week or list view for power users.
- **Rest-day blocking:** Mark a day as rest; calendar shows it and optionally warns if user tries to schedule on top.
- **Program + ad-hoc balance:** Weekly summary like “3 program workouts + 2 ad-hoc” to encourage program adherence.
- **Notifications/reminders:** Optional push or email reminder for scheduled sessions (depends on notification infrastructure).
- **Priority order for same-day events:** Let user set order (e.g. “Program first, then Tabata”) for display and export.

---

## Files to Create/Modify (Phase 1)

| File | Change |
|------|--------|
| `apps/app/src/lib/calendar-events.ts` | Extend `CalendarEvent` type; create `getUnifiedCalendarEvents` |
| `apps/app/src/components/react/hud/ScheduleZone.tsx` | Use `getUnifiedCalendarEvents`; remove separate AMRAP list |
| `apps/app/src/components/react/hud/AppCalendar.tsx` | Render multi-activity indicator; handle array of events per day |
| `apps/app/src/lib/supabase/client/calendar-completion.ts` | Extend to include `workout_logs` completion (timer apps) |

---

## Open Questions

1. **Color scheme**: How should we visually distinguish 4+ activity types on the calendar? (dots, stripes, stacked bars?)
2. **Readiness on calendar**: Should readiness check-ins appear as calendar events, or stay in TodayZone only?
3. **Timer app "Do Again"**: Should clicking a Tabata event on the calendar navigate to `/tabata-timer` with pre-filled config, or open a modal?
4. **Multiple programs per day**: If user has 2+ active programs and both schedule a workout on the same day, how to prioritize in UpcomingStrip? (Show both? Show active program only?)
5. **Calendar density**: On days with 5+ activities (e.g. readiness + program + 3 timer sessions), should we collapse to "5 activities" badge or show all inline?

---

## Recommendation: Start with Phase 1 + Phase 2

This gives immediate value:
- Calendar becomes comprehensive activity view
- Real-time updates ensure freshness
- Existing UX preserved (no breaking changes)
- Sets foundation for Phase 3+ (multi-activity drawer, unified history)

Phase 3+ can be scoped based on user feedback after Phase 1+2 are live.
