# WorkoutDetailModal — Implementation Guide

**File:** `src/components/react/WorkoutDetailModal.tsx`  
**Role:** Full-screen modal that displays a single workout’s (WOD) details: hero image and title, mission parameters, window/rest-load card, and phased exercise list. Used from the main app (AppIslands), active program view, and program sales view.

---

## 1. Overview

- **Purpose:** Show one “Artist” (workout) with name, description, intensity, image, and structured phases (warmup, main, finisher, cooldown) plus actions: Log Session, Abort View, and optionally Start workout / open player.
- **Rendering:** Renders only when `workout` is non-null. Uses Framer Motion for enter/exit; no `useReducedMotion` (animations always run).
- **Z-index:** `z-[120]` (below ExerciseDetailModal’s overlays at 140/150).

---

## 2. Data Model

The modal expects an **Artist** (see `src/types.ts`):

| Field               | Type                                | Used in modal                                         |
| ------------------- | ----------------------------------- | ----------------------------------------------------- |
| `id`                | string                              | Not rendered (for logging/keys)                       |
| `name`              | string                              | Hero title                                            |
| `image`             | string                              | Hero background image                                 |
| `day`               | string                              | “Protocol {day}” badge (e.g. “Protocol WOD”)          |
| `description`       | string                              | Mission Parameters quote                              |
| `intensity`         | 1–5                                 | Passed to `IntensityBars`                             |
| `workoutDetail`     | WorkoutDetail (optional)            | Phases and exercises                                  |
| `exerciseOverrides` | Record<string, Exercise> (optional) | Not read by modal; used by parent for exercise detail |

**WorkoutDetail** is an object with four fixed keys: `warmup`, `main`, `finisher`, `cooldown`. Each value is a **WorkoutComponent**:

- `title: string` — Phase heading (e.g. “Dynamic Activation”)
- `duration: string` — Shown in phase header (e.g. “8 Minutes”)
- `exercises: string[]` — Exercise names rendered via `ExerciseCard`

The modal iterates over `Object.entries(workout.workoutDetail || {})`, so order follows object key order (warmup → main → finisher → cooldown).

---

## 3. Props

| Prop               | Type                             | Required | Description                                                                                      |
| ------------------ | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `workout`          | `Artist \| null`                 | Yes      | Workout to display; modal returns `null` when falsy.                                             |
| `onClose`          | `() => void`                     | Yes      | Called for close (X), backdrop click, “Abort View”).                                             |
| `onLogWorkout`     | `() => void`                     | Yes      | Called when “Log Session Data” is clicked.                                                       |
| `onOpenPlayer`     | `() => void`                     | No       | If provided, shows “Start workout” under Mission Parameters (Play icon).                         |
| `onSelectExercise` | `(exerciseName: string) => void` | No       | Passed to each `ExerciseCard`; clicking a card opens exercise detail (e.g. ExerciseDetailModal). |

---

## 4. Integration Points

- **AppIslands**
  - `workout={selectedArtist}`
  - `onClose` clears `selectedArtist`.
  - `onLogWorkout` opens `LogWorkoutModal`.
  - `onSelectExercise={handleSelectExercise}` (opens exercise detail).
  - Does **not** pass `onOpenPlayer` (no “Start workout” on main app flow).

- **ActiveProgramView**
  - Uses `mapProgramWorkoutToArtist()` to build `Artist` from program schedule workout.
  - Passes `onOpenPlayer` so “Start workout” opens the workout player.
  - `onLogWorkout` and `onOpenPlayer` both set active workout and close the modal.

- **ProgramSalesView**
  - Renders modal for a mission-params workout in a sales/onboarding context (similar pattern: mapped Artist + close/log).

- **Data sources for Artist**
  - Static: `src/data/workouts.ts`, `wod.ts`, `tabata.ts`, `complexes.ts`.
  - Generated: WOD API (`generate-wod.ts`) and Firebase (`wod-service.ts`) for saved WODs.
  - Program: `map-program-workout-to-artist.ts` for program schedule workouts.

---

## 5. Layout and Structure

1. **Backdrop**
   - Full viewport, `bg-black/95 backdrop-blur-3xl`, `onClick={onClose}`.
   - Scrollable; content centered with padding.

2. **Card container**
   - `max-w-7xl`, rounded, border.
   - Inner `motion.div` for scale/y animation (no reduced-motion branch).

3. **Hero (top)**
   - Fixed-height image (`h-64` / `md:h-[32rem]`), `workout.image`, `object-cover opacity-40 grayscale`.
   - Gradient overlay.
   - Close button (top-right).
   - Bottom strip: “Protocol {workout.day}”, `IntensityBars`, workout name, and **hardcoded “Target Volume” 45:00** (not from data).

4. **Two-column grid (below hero)**
   - **Left column (lg:col-span-4):**
     - **Mission Parameters** — heading + quoted `workout.description`.
     - Optional “Start workout” button when `onOpenPlayer` is set.
     - **Window / Rest Load card** — **hardcoded** “45 Minutes” and “Compressed” (not from Artist).
     - “Log Session Data” (primary CTA) and “Abort View” (secondary).

   - **Right column (lg:col-span-8):**
     - One block per `workout.workoutDetail` entry: vertical timeline (colored dot), “Phase 0{idx+1}”, `block.title`, `block.duration`, then a grid of `ExerciseCard` for `block.exercises`.
     - Phase colors cycle: amber, orange, red, white (index-based).

---

## 6. Child Components

- **IntensityBars** (`./IntensityBars`) — `level={workout.intensity}` (1–5); five bars, filled by level.
- **ExerciseCard** (`./ExerciseCard`) — `exerciseName`, `index`, `onClick`; shows padded index (e.g. 01, 02) and name; click invokes `onSelectExercise?.(ex)`.

---

## 7. Current Limitations and Hardcoded Values

- **Target Volume** in the hero is fixed `45:00`; not derived from `workout` or `workoutDetail`.
- **Window** and **Rest Load** in the left card are fixed “45 Minutes” and “Compressed”; no `Artist` or `WorkoutDetail` fields for these.
- **Phase label** uses `Phase 0{idx + 1}`; for 10+ phases this becomes “Phase 010”, etc. No dynamic padding (unlike ExerciseDetailModal’s step numbers).
- **Type assertion:** `const block = blockValue as WorkoutComponent` — assumes every entry of `workoutDetail` is a valid `WorkoutComponent`; no runtime validation.
- **Accessibility:** Close and “Abort View” are buttons; “Log Session Data” and “Start workout” are buttons. Hero image has `alt={workout.name}`. No explicit focus trap or Escape key handling inside the modal (parent/AppIslands may handle Escape globally).
- **Image loading:** No explicit loading/error state for `workout.image`; failed image shows broken state.

---

## 8. Recommended Optimizations and Updates

### 8.1 Data-driven parameters (high value)

- Add optional fields to `Artist` (or a shared WOD type), e.g. `targetVolumeMinutes?: number`, `windowMinutes?: number`, `restLoad?: string`.
- Where WODs are generated or stored (e.g. generate-wod, Firebase), persist and pass these through.
- In the modal, render “Target Volume”, “Window”, and “Rest Load” from props/data with sensible fallbacks (e.g. “45:00”, “45 Minutes”, “Compressed”) when not provided.
- Reduces magic numbers and keeps UI aligned with backend/design.

### 8.2 Phase index formatting (low effort)

- Use dynamic padding for phase number, e.g. `(idx + 1).toString().padStart(phaseCount.toString().length, '0')`, so 10+ phases display as “Phase 10”, “Phase 11”, etc., with consistent width.
- Prevents “Phase 010” and matches the pattern used in ExerciseDetailModal for step numbers.

### 8.3 Reduce motion (a11y)

- Reintroduce `useReducedMotion()` and, when true, set `transition={{ duration: 0 }}` on the inner `motion.div` so users who prefer reduced motion get instant open/close.
- Aligns with ExerciseDetailModal and common a11y practice.

### 8.4 Hero image robustness (medium effort)

- Use a wrapper with `onError` and optional `onLoad` (e.g. hide or replace with placeholder on error).
- Consider `loading="lazy"` only if the modal is not immediately visible; for a modal that opens on user action, eager load is usually fine.
- Optional: blurhash or low-res placeholder to reduce layout shift.

### 8.5 WorkoutDetail typing and validation (medium effort)

- Replace `Object.entries(workout.workoutDetail || {}).map(...)` with iteration over a known key array (e.g. `['warmup','main','finisher','cooldown']`) and optional filter for blocks that have exercises or a non-empty title.
- Validate or type-narrow each block before casting (e.g. check `title`, `duration`, `Array.isArray(exercises)`) so invalid data doesn’t crash the UI.
- Reduces reliance on `as WorkoutComponent` and improves resilience to bad API/data.

### 8.6 Focus trap and Escape (a11y)

- Trap focus inside the modal while open (e.g. focus first focusable element on open, loop Tab within modal).
- On Escape, call `onClose()` (if not already handled at a higher level in AppIslands).
- Ensures keyboard-only users can open, navigate, and close the modal without leaving it.

### 8.7 Extract phase color map (maintainability)

- Move the `colors` array (and index logic) to a small constant or helper (e.g. `getPhaseColor(index)`) so phase styling is consistent and easier to change (e.g. theme or more than four phases).

### 8.8 Optional performance

- If `workout.workoutDetail` is large and the list of phases/exercises is long, consider virtualizing the right column (e.g. react-window) only if profiling shows scroll jank; otherwise keep the current DOM structure for simplicity.

---

## 9. Summary

| Area                | Status             | Suggestion                                                                       |
| ------------------- | ------------------ | -------------------------------------------------------------------------------- |
| Data model          | Clear              | Add optional window/targetVolume/restLoad to Artist (or WOD type) and use in UI. |
| Props / integration | Documented         | No change required.                                                              |
| Hardcoded values    | Present            | Replace “45:00”, “45 Minutes”, “Compressed” with data + fallbacks.               |
| Phase index         | Fixed 2 digits     | Use dynamic padding for 10+ phases.                                              |
| Reduced motion      | Removed            | Restore `useReducedMotion` and zero-duration transition when set.                |
| Hero image          | No error handling  | Add onError (and optional placeholder).                                          |
| Type safety         | Assertion on block | Iterate over known keys and validate/narrow block shape.                         |
| A11y                | Partial            | Add focus trap and Escape handling if not global.                                |
| Phase colors        | Inline             | Extract to constant/helper for maintainability.                                  |

This guide reflects the implementation as of the current codebase and is intended for maintainers and future front-end/UI optimization work on the modal.
