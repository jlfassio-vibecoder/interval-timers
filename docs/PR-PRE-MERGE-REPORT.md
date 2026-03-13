# Pre-Merge Report

**Branch:** `polish/amrap-with-friends-misc`  
**Date:** 2026-03-13  
**Reviewer:** Senior Lead Engineer (Final PR Gatekeeper)

---

## Phase 1: Triage & Execution

Reviewed all changed files against the Decision Matrix (Critical / Performance / Style). Applied fixes where warranted; ignored nitpicks and pre-existing patterns.

---

## Fixed

| Issue | File | Resolution |
|-------|------|------------|
| **useMemo dependency** | `AmrapSetupContent.tsx` | `itemIds` deps changed from `[customExercises.length]` to `[customExercises]` — React Compiler / exhaustive-deps correct. |
| **Duplicate exercise added** | `AmrapSetupContent.tsx` | Added early `return` when duplicate detected in `handleSubmit`; previously validation showed warning but still added. |
| **Unstable recent workouts key** | `AmrapSetupContent.tsx` | Switched `key={i}` to `key={r.completedAt}` for stable list identity. |
| **Blank timer saved to recent** | `BuildWorkoutFlow.tsx`, `useAmrapSetup.ts` | Only call `saveRecentCustomWorkout` when `workoutList.length > 0`. |
| **DnD ID instability** | `useAmrapSetup.ts`, `BuildWorkoutFlow.tsx`, `AmrapSetupContent.tsx` | Added `CustomExercise.id`, `createCustomExercise`, `parseToCustomExercise`; use `ex.id` for sortable keys/IDs instead of index. |
| **Exercise suggestions per-render** | `amrap-setup-data.ts`, `AmrapSetupContent.tsx` | Added `EXERCISE_SUGGESTIONS` module constant; use it instead of calling `getExerciseSuggestions()` on each render. |
| **Custom duration parsing** | `AmrapSetupContent.tsx` (DurationStep) | Use `Number()` + `Number.isInteger()`; add `step={1}`; shared `isValidCustomMinutes` validation. |
| **Redundant condition** | `AmrapSetupContent.tsx` (DurationStep) | Simplified `templatesCustom`: when `customMinsNum != null`, it is already 1–60; removed redundant range check. |

---

## Slop Scrubbed

| Item | Location | Action |
|------|----------|--------|
| Redundant range check | `DurationStep` `templatesCustom` | `customMinsNum >= 1 && customMinsNum <= 60` was redundant (guaranteed by `isValidCustomMinutes`); simplified to `customMinsNum != null`. |

*No redundant comments, hallucinated APIs, or dead logic identified in changed files. Existing comments (section markers, JSDoc, intentional empty-catch note) retained.*

---

## Ignored

| Suggestion | Reason |
|------------|--------|
| WeekCalendar `initialSelectedSession` in useEffect deps | Pre-existing; adding would trigger unwanted re-runs. Intentional primitive deps already in place. |

---

## Verification

- **Lint:** Passes (1 non-blocking warning in WeekCalendar; pre-existing)
- **Build:** `npm run build -w amrap` succeeds
- **Node APIs in client:** None in `apps/amrap/src`
- **import.meta.env:** Vite app uses `VITE_*`, `DEV`, `BASE_URL`; no secrets
- **TODOs / FIXMEs:** None in changed files
- **APIs:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `isValidQty`, `formatQtyHint`, `getRecentCustomWorkouts`, `saveRecentCustomWorkout` — all exist and match usage

---

## Status: READY TO MERGE
