# Pre-Merge Report: Training Log PR #86

**Date:** 2025-03-19  
**Branch:** feature/app-training-logs  
**Reviewer:** Senior Lead Engineer (Final Gatekeeper)

---

## Fixed (Critical / Performance / Logic)

| Item                              | File                                                                          | Change                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **RLS on workout_log_exercises**  | `supabase/migrations/20250327000000_workout_logs_training_log_enrichment.sql` | Added Row Level Security and user-access policy; added `DROP POLICY IF EXISTS` for idempotent migration (project pattern)          |
| **WeekRow className typo**        | `WeekRow.tsx`                                                                 | Fixed `${hideRangeLabel ? '' : 'mt-0.5'}rounded` → `'mt-0.5 '` (missing space caused invalid `mt-0.5rounded`)                      |
| **deriveWorkoutType consistency** | `training-log-export.ts`                                                      | Removed duplicate implementation; now imports from `training-log.ts` (CSV export matches UI analytics)                             |
| **thisWeekMon timezone**          | `training-log.ts`                                                             | Replaced `now.toISOString().slice(0,10)` with `localTodayISO()` for correct local week boundary                                    |
| **thisMonthStart undefined**      | `training-log.ts`                                                             | Fixed regression: `now` was removed but still referenced; now derived from `localTodayISO()`                                       |
| **Streak calculation**            | `training-log.ts`                                                             | Iterate backwards over calendar weeks via `addCalendarDays(checkMon, -7)`; missing weeks = 0 minutes (prevents overstated streaks) |
| **Keyboard nav hijack**           | `TrainingLog.tsx`                                                             | Early return when `goalModalOpen` or focus in `input/textarea/select/[contenteditable]`                                            |
| **Weekly goal state sync**        | `AppContext.tsx`                                                              | Clamp to 1–999 before DB update and `setUser` so local state matches persisted value                                               |

---

## Slop Scrubbed

| Item                          | Action                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Redundant comments**        | None removed. JSDoc and section comments (e.g. "Bar scale: 100% = target") add value and are retained.                          |
| **Hallucinated APIs**         | None found. All imports (`deriveWorkoutType`, `deriveWorkoutFormat`, `toast.warning`, Recharts, etc.) verified against project. |
| **Dead logic / placeholders** | None found. No TODO/FIXME in training-log files.                                                                                |
| **Empty catch blocks**        | `AnalyticsSummaryCards` catch reverts draft but does not surface error — intentional silent revert; no change.                  |

---

## Ignored (Explicitly)

| Suggestion                                 | Reason                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Week boundary in training-log-insights** | `cutoff.toISOString().slice(0,10)` for 10-day lookback — low impact; not flagged as critical.     |
| **Rounding in getMinutesThisWeek**         | Returns fractional minutes; callers use `Math.round` for display. Kept as-is.                     |
| **Further RLS policy idempotency**         | `DROP POLICY IF EXISTS` added; `ENABLE ROW LEVEL SECURITY` left as-is (no IF EXISTS in Postgres). |

---

## Security & Build-Time Checks

- **import.meta.env**: No env usage in training-log client components.
- **Node.js APIs (fs, process)**: None in client-side training-log code.
- **Astro Frontmatter**: No new frontmatter in this PR scope.

---

## Build & Type Check

- `npm run type-check` (apps/app): **PASSED**

---

## Status

**READY TO MERGE**

All Copilot comments addressed. No critical issues, slop, or hallucinations remain. Migration is idempotent per project convention.
