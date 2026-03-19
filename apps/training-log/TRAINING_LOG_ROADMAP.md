# Training Log App — Implementation Roadmap

**Purpose:** Scaffold and implement the Training Log app with HUD preview, landing page, and full analytics ecosystem for progress evaluation and goal-oriented guidance.

**References:**
- [TRAINING_LOG_COMPONENT_REFERENCE.md](./TRAINING_LOG_COMPONENT_REFERENCE.md) — Component structure, SWOT gaps, database schema
- [training-log-mockup.tsx](./training-log-mockup.tsx) — Visual design, bubble sizing, filters, modal

---

## Executive Summary

| Phase | Focus | Effort | Deliverable |
|-------|-------|--------|-------------|
| **0** | Scaffolding & data alignment | 1–2 days | Repo structure, schema, app registry |
| **1** | HUD preview integration | 1–2 days | Training log strip in HUD, nav entry |
| **2** | Landing page & routing | 1 day | Dedicated route, marketing entry |
| **3** | Core log (backend + filters) | 2–3 days | Real data, functional filters |
| **4** | Performance & accessibility | 1–2 days | Memoization, a11y, mobile |
| **5** | Analytics dashboard | 2–3 days | Trends, volume, distribution |
| **6** | Goals & AI guidance | 2–4 days | Weekly goals, insights, recommendations |

---

## Phase 0: Scaffolding & Data Alignment

**Effort:** 1–2 days  
**Dependencies:** None

### 0.1 Repository & App Structure

**Option A — In-app section (recommended):**  
Treat Training Log as a section within `apps/app`, similar to Programs/Calendar. Route: `/interval-timers/training-log` or `/training-log`.

**Option B — Standalone app:**  
Create `apps/training-log` as a separate Vite/React app (like AMRAP), with its own deployment and base URL.

**Recommendation:** Option A — unified auth, shared `workout_logs`, simpler HUD integration.

```
apps/app/src/
├── pages/
│   └── training-log/
│       └── index.astro              # Route: /training-log
├── components/react/training-log/
│   ├── TrainingLog.tsx              # Main container
│   ├── ActivityDot.tsx              # Workout bubble (extract from mockup)
│   ├── WeekRow.tsx                  # Single week row
│   ├── FilterBar.tsx                # Type/Format/Duration/Active Rest
│   ├── WorkoutSummaryModal.tsx      # Detail modal
│   └── TrainingLogPreview.tsx       # Compact HUD preview
├── hooks/
│   ├── useTrainingLogWeeks.ts       # Data fetch
│   └── useTrainingLogFilters.ts     # Filter state
└── lib/supabase/client/
    └── training-log.ts              # API (or extend workout-logs)
```

### 0.2 Data Model Alignment

**Current state:** `workout_logs` stores: `workout_name`, `date`, `effort`, `rating`, `notes`, `duration_seconds`, `source`, `rounds`, etc. Limited to summary-level; no `workout_type`, `workout_format`, `focus_area`, or `workout_exercises`.

**Paths forward:**

| Approach | Pros | Cons |
|----------|------|------|
| **A. Extend workout_logs** | Single source of truth, no migration of handoff data | Schema creep; workout_exercises needs separate table |
| **B. New training_log_entries table** | Clean model, explicit training-log semantics | Dual-write from handoff apps; sync complexity |
| **C. Hybrid: extend + optional detail** | Backward compatible; detail optional | More nullable columns |

**Recommendation:** **Approach A with optional enrichment.**

1. Add nullable columns to `workout_logs`: `workout_type`, `workout_format`, `intensity`, `focus_area`, `is_active_rest`.
2. Add `workout_log_exercises` table (optional detail) for users who log structured workouts.
3. Handoff apps (Tabata, AMRAP, Daily Warm-Up) continue writing summary-only; Training Log can backfill `workout_type`/`format` from `source` (e.g. `source=tabata` → `workout_format=Tabata`).

```sql
-- Migration: enrich workout_logs for training log
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS workout_type text;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS workout_format text;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS intensity text;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS focus_area text;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS is_active_rest boolean DEFAULT false;

-- Optional: workout_log_exercises for structured logging
CREATE TABLE IF NOT EXISTS workout_log_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  phase text CHECK (phase IN ('warmup', 'main', 'cooldown')),
  exercise_name text NOT NULL,
  sets int, reps int, duration_seconds int, weight_lbs numeric,
  notes text, order_index int NOT NULL
);
CREATE INDEX idx_workout_log_exercises_log ON workout_log_exercises(workout_log_id);
```

### 0.3 App Registry & Navigation

- Add `{ id: 'training-log', name: 'Training Log', path: '/training-log', description: 'Track & analyze workouts' }` to `APP_REGISTRY`.
- Add nav link in HUD header/sidebar (alongside Programs, History).
- Ensure handoff logs surface in Training Log (same `workout_logs` table).

---

## Phase 1: HUD Preview Integration

**Effort:** 1–2 days  
**Dependencies:** Phase 0

### 1.1 HUD Training Log Strip

Create a compact **Training Log preview** that appears in the HUD (e.g. below ProgressZone or in a new “Insights” strip):

- **Content:** This week’s total minutes, color-coded (red &lt;100, orange 100–149, green 150+), link to full Training Log.
- **Data source:** Aggregate `workout_logs` by week (sum `duration_seconds` or derived duration), filtered by `user_id`.
- **Placement:** New section in `HUDContent` or extend `ProgressZone` with a “Training” card.

```
┌─────────────────────────────────────────────────┐
│ This week: 142 min  [View Training Log →]       │
│ ████████████░░░░ (95% of 150 min goal)          │
└─────────────────────────────────────────────────┘
```

### 1.2 Entry Points

- **HUD nav:** “Training Log” link → `/training-log`
- **Account landing:** Training Log card in app grid (reuse `APP_REGISTRY`).
- **Calendar:** Optional “View in Training Log” from HistoryZone session detail (deep link by date).

---

## Phase 2: Landing Page & Routing

**Effort:** ~1 day  
**Dependencies:** Phase 0

### 2.1 Route & Page

- **Path:** `/training-log`
- **Page:** Astro page that mounts `TrainingLog` React component (or full-page React route if app uses client-side routing).
- **Auth:** Require sign-in; redirect to login with `?redirect=/training-log`.

### 2.2 Landing Content

- **Hero:** Value prop — “Track every workout. See progress. Hit your goals.”
- **Preview:** Static or sample view of the weekly bubble grid (similar to mockup).
- **CTA:** “Start Tracking” → sign-in or `/training-log` if authenticated.
- **Features list:** Visual calendar, filters, weekly goals, analytics, export.

### 2.3 SEO & Meta

- Title: “Training Log | AI Fitness Guy”
- Description: “Track workouts, analyze trends, and stay on track with your fitness goals.”

---

## Phase 3: Core Log — Backend & Functional Filters

**Effort:** 2–3 days  
**Dependencies:** Phase 0, 1, 2

### 3.1 Data Fetching

- **API:** `getTrainingLogWeeks(userId, rangeStart, rangeEnd, filters)`.
- **Filters:** `workout_type`, `workout_format`, `duration_range`, `exclude_active_rest`.
- **Aggregation:** Group by week (Mon–Sun), sum duration per day, count sessions per day.
- **Source:** Query `workout_logs` (+ handoff); derive `workout_type`/`format` from `source` when null.

```typescript
// Pseudocode
const rows = await supabase
  .from('workout_logs')
  .select('*')
  .eq('user_id', userId)
  .gte('date', rangeStart)
  .lte('date', rangeEnd);

// Apply filters (Type, Format, Duration, Exclude Active Rest)
// Aggregate by week + day
// Return: { weeks: { range, totalMinutes, days: [{ count, minutes }] } }
```

### 3.2 Functional Filters

- **Type:** Filter by `workout_type` (or inferred from `source`).
- **Format:** Filter by `workout_format`.
- **Duration:** Filter by `duration_seconds` (or derived minutes) within ranges: 15, 30, 45, 60, 90, 120+.
- **Exclude Active Rest:** `WHERE is_active_rest IS NOT TRUE`.
- **Server-side:** Prefer filtering in query for scalability; client-side acceptable for small result sets initially.

### 3.3 Component Refactor

- Extract `ActivityDot`, `WeekRow`, `FilterBar`, `WorkoutSummaryModal` from mockup.
- Replace `sampleWorkouts` with real data from `getTrainingLogWeeks`.
- Wire `WorkoutSummaryModal` to `workout_logs` row (effort, rating, notes, duration, optional exercises).
- Implement `shouldShowWorkout()` with actual filter logic (reference doc Phase 2).

### 3.4 Date Range & Pagination

- Default: last 8–12 weeks.
- “Load more” or infinite scroll for older data.
- Optional date range picker (Calendar icon) for custom range.

---

## Phase 4: Performance & Accessibility

**Effort:** 1–2 days  
**Dependencies:** Phase 3

### 4.1 Performance (Reference Doc Phase 3)

- Memoize `splitWorkoutTime`, bubble size/color calculations with `useMemo`.
- `React.memo` on `ActivityDot`, `WeekRow`.
- Consider `useReducer` for filter + UI state to reduce re-renders.
- Lazy-load older weeks (virtualized list if needed).

### 4.2 Accessibility (Reference Doc)

- Keyboard nav: Arrow keys for week navigation, Enter to open workout, Escape to close modal.
- ARIA labels on filters, bubbles, modal.
- Focus trap in modal; focus management on open/close.
- `role="status"` for week range announcements.
- Touch targets ≥44px on mobile.

### 4.3 Mobile Optimization

- Responsive grid (`grid-cols-7`, gap scales with viewport).
- Bottom sheet or full-screen modal on small screens.
- Swipe gestures for week navigation (optional).
- Touch-friendly filter dropdowns.

---

## Phase 5: Analytics Dashboard

**Effort:** 2–3 days  
**Dependencies:** Phase 3

### 5.1 Weekly Volume Trends

- Line chart: weekly total minutes over last 12–24 weeks.
- Use Recharts or existing chart library in app.
- Data: same `getTrainingLogWeeks` aggregation, broader range.

### 5.2 Distribution Charts

- **By type:** Pie/bar of minutes per `workout_type` (Strength, Cardio, Mobility, etc.).
- **By format:** Minutes per `workout_format` (HIIT, AMRAP, etc.).
- **By focus area:** If `focus_area` populated.
- **By day of week:** Heatmap or bar of activity by weekday.

### 5.3 Summary Cards

- **This week:** Total minutes, sessions, vs. goal.
- **This month:** Same.
- **Streak:** Consecutive weeks meeting goal.
- **Most active day:** e.g. “Tuesday” (highest avg minutes).

### 5.4 Export

- CSV export: date, duration, type, format, effort, rating, notes.
- Reuse pattern from calendar ICS export.

---

## Phase 6: Goals & AI Guidance

**Effort:** 2–4 days  
**Dependencies:** Phase 5

### 6.1 Weekly Goals

- **user_profiles** or new `user_training_goals`: `weekly_goal_minutes` (default 150).
- UI: Set/edit goal in Training Log settings or dashboard.
- Progress bar: This week’s total vs. goal (in HUD preview and full log).
- Optional: Goal achievement badge/toast.

### 6.2 Insights Engine

- **Rule-based (MVP):**
  - “Volume dropped 40% vs. last month.”
  - “No legs in 10 days.”
  - “Cardio down 3 weeks in a row.”
- **Inputs:** Aggregated weekly data, type/format distribution, recency.
- **Output:** Short text insight + optional “See details” link.

### 6.3 AI-Powered Guidance (Future)

- Use Gemini/Vertex AI to analyze patterns and suggest:
  - “Consider adding a mobility session this week.”
  - “Your strength volume is trending up — a deload week might help.”
- Requires: Structured prompt, workout history as context, guardrails for safety.
- Defer to post-MVP if time-constrained.

---

## Integration with Existing Systems

| System | Integration |
|--------|-------------|
| **workout_logs** | Primary data source; extend with training-log fields |
| **Calendar (HUD)** | Training Log preview strip; optional “View in Training Log” from History |
| **HistoryZone** | Shares same logs; Training Log adds structured view + analytics |
| **Handoff apps** | Tabata, AMRAP, Daily Warm-Up write to workout_logs; Training Log displays them |
| **App registry** | Add Training Log entry for account page and nav |
| **Auth** | Same Supabase auth; no new auth flow |

---

## File Touchpoints

| Area | Files to Create/Modify |
|------|------------------------|
| **Routing** | `apps/app/src/pages/training-log/index.astro` (or equivalent) |
| **Components** | `apps/app/src/components/react/training-log/*` |
| **Hooks** | `apps/app/src/hooks/useTrainingLogWeeks.ts`, `useTrainingLogFilters.ts` |
| **API** | `apps/app/src/lib/supabase/client/training-log.ts` or extend `workout-logs.ts` |
| **HUD** | `HUDContent.tsx`, `ProgressZone.tsx` or new `TrainingLogPreview.tsx` |
| **Registry** | `apps/app/src/lib/app-registry.ts` |
| **Schema** | `supabase/migrations/YYYYMMDD_training_log_workout_logs_enrichment.sql` |
| **Types** | `apps/app/src/types.ts` (extend `WorkoutLog` if needed) |

---

## Success Criteria

- [ ] User can view weekly bubble grid with real data from `workout_logs`
- [ ] Filters (Type, Format, Duration, Exclude Active Rest) correctly filter displayed data
- [ ] HUD shows this week’s total + link to Training Log
- [ ] Landing page exists and routes to full Training Log when signed in
- [ ] Workout detail modal shows effort, rating, notes, duration
- [ ] Analytics: weekly trend chart, distribution by type/format
- [ ] Weekly goal with progress indicator
- [ ] CSV export
- [ ] Keyboard accessible, mobile responsive
- [ ] No regressions in existing HUD or History flows

---

## Cursor AI Prompts (Quick Reference)

1. **“Create Supabase migration to add workout_type, workout_format, intensity, focus_area, is_active_rest to workout_logs”**
2. **“Implement getTrainingLogWeeks API that aggregates workout_logs by week with optional filters”**
3. **“Extract ActivityDot, WeekRow, FilterBar from training-log-mockup into separate components”**
4. **“Add Training Log preview strip to HUDContent showing this week’s total minutes”**
5. **“Wire Training Log filters to actually filter the data in getTrainingLogWeeks”**
6. **“Add /training-log route and landing section with hero and CTA”**
7. **“Create analytics dashboard with Recharts: weekly volume trend and type distribution”**
8. **“Implement weekly goal setting with progress bar in Training Log and HUD preview”**
9. **“Add keyboard navigation and ARIA labels to Training Log components”**
10. **“Add CSV export for Training Log data”**
