# HUD Implementation — SWOT Analysis

**Scope:** Heads Up Display (HUD) — the workout management hub in `apps/app`

**Components:** `HUDShell`, `HUDContent`, `TodayZone`, `ProgressZone`, `ScheduleZone`, `HistoryZone`, `AmrapProgressSection`, `HUDHeader`, `NotificationPanel`, `ProgramSidebar`

**Date:** March 2025

---

## Overview

The HUD is the central place for users to manage workouts across all apps (Programs, AMRAP With Friends, Tabata, etc.). It can run as an **overlay** (fixed full-screen, close button) or **page-embedded** (e.g. `/account?hud=1`). Entry points include the nav "You" button, `?hud=1` URL param, and `CustomEvent('showHUD')` from AccountLanding and AMRAP recap modal.

---

## Strengths

| Area | Description |
|------|-------------|
| **Unified workout hub** | Single destination for today's workout, progress, schedule, and history across programs and AMRAP. Reduces context-switching. |
| **Flexible layout modes** | Overlay mode (onClose) for quick access; embedded mode when used as account page. Same content, different chrome. |
| **Progressive upgrade** | `isPaid` and `showUpgradePrompts` gate real data vs placeholder; ProgressiveUpgradeBanner for free users. Clear conversion path. |
| **AMRAP integration** | HistoryZone shows AMRAP results (RPC) with detail drawer, Do Again, Schedule. AmrapProgressSection charts rounds and consistency over time. ScheduleZone displays AMRAP scheduled sessions. |
| **Session fallback** | HistoryZone uses `effectiveUserId = user?.uid ?? session?.user?.id` so AMRAP results fetch immediately before profile loads. Avoids empty state on first paint. |
| **Notification system** | `useDerivedNotifications` derives client-side notifications; HUDHeader bell + NotificationPanel; no extra backend. |
| **Program sidebar** | Optional ProgramSidebar (saved programs, activation) in two-column layout on lg+ screens. |
| **Accessibility** | `useReducedMotion` for animations; ARIA roles; Escape and keyboard support in drawers/modals. |
| **Calendar + history linkage** | ScheduleZone `onViewLog` scrolls to HistoryZone; calendar events open WorkoutEventDrawer. |
| **Consistent data flow** | AppContext (user, activeProgramId, isPaid) flows down; zones fetch from Supabase via shared clients. |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **Dual log sources** | Program sessions from `user_workout_logs` (WorkoutPlayer); AMRAP/handoff from `workout_logs`. HistoryZone merges two feeds mentally but they remain separate systems. |
| **No real-time updates** | All zones refetch on mount or refreshKey; no Supabase realtime or polling. Calendar/history can be stale until user navigates. |
| **Calendar refresh coupling** | ScheduleZone refetches only when `calendarRefreshKey` changes (e.g. after Sync to Calendar). No automatic refresh on AMRAP session create. |
| **Readiness storage hack** | Readiness (1–5) stored in `workout_logs` with special row (`workout_name='Readiness'`, `effort=1`, `rating=1`). Works but couples readiness to generic log schema. |
| **Free-tier placeholder** | ProgressZone shows placeholder chart + upgrade CTA when `!isPaid`. No teaser of actual data. |
| **History filter complexity** | HistoryZone filter (all / this_week / this_month / by_program) + AMRAP list; two parallel UIs in one zone. |
| **AMRAP session URL** | "View session" links to `/amrap/with-friends/session/{id}`; cross-origin in dev if AMRAP on different port. |
| **Env sensitivity** | `VITE_HUD_REDIRECT_URL`, `VITE_ACCOUNT_REDIRECT_URL` affect AMRAP → account/hub flow. Misconfig can send users to wrong page. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **Real-time subscriptions** | Supabase `channel().on('postgres_changes', ...)` for workout_logs, user_workout_logs, amrap_sessions. Keep calendar and history fresh. |
| **AMRAP calendar auto-refresh** | When `createAmrapSession` or schedule modal succeeds, bump `calendarRefreshKey` so ScheduleZone refetches without manual sync. |
| **Today Zone readiness insights** | Correlate readiness_score with workout performance over time; surface "Your best workouts come after Strong/Fire days" style insights. |
| **Mobile-optimized layout** | Sidebar collapses to bottom sheet or tab on small screens; larger touch targets; simplified Progress tabs. |
| **Unified history view** | Single chronological feed merging program sessions and AMRAP results with consistent cards and actions. |
| **Admin analytics migration** | `docs/ADMIN_ANALYTICS_MIGRATION_FILE_LIST.md` exists; HUD components could be extended for trainer-facing analytics. |
| **Readiness as first-class** | Dedicated `readiness_scores` table or view instead of overloading workout_logs. Cleaner queries and future features (e.g. trends). |
| **Deep links** | Support `?hud=1&scroll=history` or `&open=amrap-{id}` for direct navigation from external links (e.g. email, push). |

---

## Threats

| Area | Description |
|------|-------------|
| **RLS and migration drift** | HUD relies on `workout_logs`, `user_workout_logs`, `shared.amrap_session_results`, `public.get_amrap_session_results`. RLS policies and migrations in `apps/app`, `supabase/` must stay in sync. |
| **Shared schema coupling** | AMRAP results live in `shared.amrap_session_results`; exposed via `public.get_amrap_session_results` RPC. Changes to shared schema can break HUD. |
| **Env misconfiguration** | Wrong `VITE_HUD_REDIRECT_URL` (e.g. `/?hud=1` instead of `/account`) can send "View in History" users to hub root instead of account page. |
| **Profile vs session timing** | HistoryZone uses `effectiveUserId` to bridge profile load delay. If AppContext session is slow, AMRAP fetch may still delay. |
| **Overlay state leakage** | HUD overlay is controlled by `showHUD` in AppIslands. `?hud=1` sets it on load; closing removes overlay but URL may still show `hud=1` (intentional for bookmarking). Potential confusion if user expects URL to reflect overlay state. |
| **Notification derivation limits** | Notifications are derived client-side from programs/schedule. No server-push; new assignments or schedule changes require page load or manual refresh. |

---

## Architecture Summary

```
AppIslands (showHUD, calendarRefreshKey)
  └── HUDShell (overlay | page, banner, sidebar)
        ├── ProgressiveUpgradeBanner (free)
        ├── HUDHeader (close, notification bell)
        ├── NotificationPanel
        └── HUDContent
              ├── TodayZone (ReadinessCheckIn, TodayWorkoutCard, QuickStatsBar)
              ├── ProgressZone (VolumeChart, ConsistencyHeatmap, PRFeed)
              ├── ScheduleZone (AppCalendar, UpcomingStrip, AMRAP sessions)
              ├── HistoryZone (SessionFeed, AMRAP results, drawers)
              └── AmrapProgressSection (rounds + consistency charts)
```

**Data dependencies:**
- `workout_logs` — readiness, handoff logs
- `user_workout_logs` — program session history, calendar completion
- `shared.amrap_session_results` (via RPC) — AMRAP results for HistoryZone + AmrapProgressSection
- `amrap_sessions` — scheduled AMRAP sessions for ScheduleZone

---

## Recommendations

1. **Add real-time or periodic refresh** for ScheduleZone and HistoryZone when data may change (e.g. after AMRAP schedule, calendar sync).
2. **Bump `calendarRefreshKey`** when AmrapScheduleModal or HistoryZone "Do Again" creates a session, so ScheduleZone reflects new events.
3. **Document `VITE_HUD_REDIRECT_URL` vs `VITE_ACCOUNT_REDIRECT_URL`** in a single env reference (e.g. `AUTH_ENV_AND_REDIRECTS.md`) to reduce misconfig.
4. **Consider unified history** as a future refactor: single feed with mixed program + AMRAP items, unified filters and actions.
5. **Evaluate readiness storage** — if readiness features expand, move to dedicated table or view for clarity.
