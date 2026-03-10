# Audit: Programs — Exercise Formatting and Parsing Workflow

**Date:** 2025-02-12  
**Scope:** How exercises are formatted and parsed after program generation (4-step chain and related APIs).

---

## 1. Overview

Programs are generated via a **4-step prompt chain** (Architect → Biomechanist → Coach → Mathematician). The **Mathematician** (Step 4) produces the final schedule: weeks, workouts, warmup blocks, and main exercise blocks. This audit traces how that output is parsed, validated, normalized, persisted, and consumed.

---

## 2. Generation Flow

### 2.1 Step 4 (Mathematician) output shape

- **File:** `src/lib/prompt-chain/step4-mathematician.ts`
- **Prompt:** Asks the model to output a `schedule` array. The **example in the prompt** uses the **legacy format**:
  - `workouts[].blocks`: array of **flat** exercise objects (each item has `exerciseName`, `exerciseQuery`, `sets`, `reps`, `rpe`, `restSeconds`, `coachNotes`).
  - So the model is instructed to produce `blocks` (flat list of exercises), **not** `exerciseBlocks` (grouped blocks with nested `exercises`).

### 2.2 Types (canonical vs legacy)

- **File:** `src/types/ai-program.ts`
- **ProgramSchedule.workouts[]** supports two shapes:
  - **Legacy:** `blocks?: Exercise[]` — flat list of exercises.
  - **Canonical:** `exerciseBlocks?: ExerciseBlock[]` — each block has `exercises: Exercise[]`.
- **Exercise** includes: `order`, `exerciseName`, `exerciseQuery?`, `sets`, `reps` (typed as `string`; AI may return number), `rpe?`, `restSeconds?`, `coachNotes?`, `id?`.

---

## 3. Parsing and Validation

### 3.1 JSON parsing

- **File:** `src/lib/json-parser.ts`
- **Usage:** `parseJSONWithRepair(step4Response)` in `generate-program-chain.ts`.
- Strategy: direct parse → strip markdown code blocks → `jsonrepair` → manual repair. Returns `{ data, wasRepaired, ... }`.

### 3.2 Mathematician output validation

- **File:** `src/lib/prompt-chain/step4-mathematician.ts` — `validateMathematicianOutput(data)`
- **Accepts both formats:**
  - If `workout.exerciseBlocks` is a non-empty array: validates each block has an `exercises` array and each exercise has `exerciseName`, `sets`, and `reps` (string or number).
  - Else if `workout.blocks` is a non-empty array: validates each item as a flat exercise (same required fields).
- **Does not:** normalize `blocks` → `exerciseBlocks`, or coerce `reps` to string. Validation is permissive on `reps` (string | number).

### 3.3 Result

- After validation, **generate-program-chain** (and **generate-challenge-chain**) now run `normalizeProgramSchedule` before building the response, so the API returns **canonical format** (`exerciseBlocks`, reps string). **generate-workout-chain** runs `normalizeWorkoutSet` before response.

---

## 4. Normalization (where it happens)

### 4.1 `program-schedule-utils.ts`

- **normalizeWorkoutForEditor(workout)**
  - If `exerciseBlocks` exists and non-empty: normalizes each block’s exercises with `withRepsAsString` (reps number → string).
  - Else: builds `exerciseBlocks: [{ order: 1, name: 'Main', exercises: legacyBlocks.map(withRepsAsString) }]` from `blocks`.
  - Returns a workout with **`exerciseBlocks` guaranteed** and **reps as string**.

- **getExercisesFromWorkout(workout)**
  - If `exerciseBlocks` exists and non-empty: returns `exerciseBlocks.flatMap(b => b.exercises ?? [])`.
  - Else: returns `blocks ?? []`.
  - Used by display and mapping (e.g. `mapProgramWorkoutToArtist`, `WorkoutPlayer`).

- **normalizeProgramSchedule(program)**
  - Maps each week’s workouts through `normalizeWorkoutForEditor` so every workout has `exerciseBlocks` and reps as string.
  - **Used by:** `generate-program.ts`, `extend-program.ts`, `generate-program-chain.ts`, `generate-challenge-chain.ts` before returning; and by admin POST programs/challenges before persistence.

- **normalizeWorkoutSet(set)**
  - Maps `set.workouts` through `normalizeWorkoutForEditor`. For objects with a flat `workouts` array (no weeks), e.g. WorkoutSetTemplate.
  - **Used by:** `generate-workout-chain.ts` before returning; and by admin POST workouts before persistence.

### 4.2 ProgramBlueprintEditor (client)

- **File:** `src/components/react/admin/ProgramBlueprintEditor.tsx`
- On init: `useState(() => normalizeScheduleForEditor(initialData))`, where `normalizeScheduleForEditor` runs `normalizeWorkoutForEditor` on every workout and assigns stable IDs to blocks/exercises.
- So when the user sees the preview after chain generation, the **editor state is already normalized** (legacy `blocks` → `exerciseBlocks`, reps → string).
- **Save:** The modal saves the **editor state** (`editedProgram`), so saved programs are stored in **normalized form** (exerciseBlocks, reps string) as long as the user goes through the preview/editor.

---

## 5. Persistence

### 5.1 Admin POST (create program)

- **File:** `src/pages/api/admin/programs/index.ts`
- **saveProgramServer(programData, ...)** runs `normalizeProgramSchedule(programData)` before writing. Firestore receives canonical format (exerciseBlocks, reps string). Same pattern for challenges and workouts (normalize before write).

### 5.2 Admin GET (fetch full program)

- **File:** `src/pages/api/admin/programs/[programId].ts`
- **fetchFullProgramServer** rehydrates from master + week docs and returns `ProgramTemplate` with `schedule` as stored. **No normalization on read.**

### 5.3 Summary

- Programs are stored in the shape provided by the client (in practice, normalized, because the only UI path is via the editor).
- If a consumer ever sent raw chain output (e.g. with `blocks` and numeric `reps`), it would be stored and returned as-is; all readers that use `getExercisesFromWorkout` or `normalizeWorkoutForEditor` still handle both formats.

---

## 6. Consumption (display and playback)

### 6.1 Mapping to Artist / WorkoutDetailModal

- **map-program-workout-to-artist.ts:** Uses `getExercisesFromWorkout(workout)` to get a flat list of exercises, then builds `workoutDetail` (warmup, main, finisher, cooldown) and `exerciseQueryMap` from `exerciseName`/`exerciseQuery`.
- **map-workout-in-set-to-artist.ts:** Same pattern for WorkoutInSet (workout sets). Both support either `blocks` or `exerciseBlocks` via `getExercisesFromWorkout`.

### 6.2 ActiveProgramView and WorkoutPlayer

- **ActiveProgramView** uses `getExercisesFromWorkout` and `mapProgramWorkoutToArtist` to build cards and mission params.
- **WorkoutPlayer** receives structures that ultimately come from those helpers; it displays `block.reps` (targetReps). Reps are expected to be string by type; normalization in the editor path ensures that for saved programs.

---

## 7. Other entry points

### 7.1 generate-program.ts (single-shot API)

- Has its own validation that accepts both `blocks` and `exerciseBlocks`.
- **After validation:** runs `normalizeProgramSchedule(programData)` and returns the **normalized** program. So this API always returns canonical shape and string reps.

### 7.2 extend-program.ts

- Parses extended program, then returns `normalizeProgramSchedule(extendedProgram)`. So extended programs are returned in normalized form.

### 7.3 Workout generator (workout chain)

- **step4-workout-mathematician.ts** prompts for **exerciseBlocks** (nested blocks with `exercises`). So the **single-workout** flow uses the canonical shape in the prompt; the **program** chain uses the legacy shape in the prompt.

---

## 8. Findings and Recommendations

### 8.1 Format duality

- **Prompt vs type:** The program Mathematician prompt teaches **`blocks`** (flat); the type system treats **`exerciseBlocks`** as canonical. Validation and all consumers accept both; normalization is done in the editor and in `generate-program` / `extend-program`, but **not** in `generate-program-chain`.
- **Recommendation (optional):** For a single canonical shape from the chain, call `normalizeProgramSchedule(program)` in `generate-program-chain.ts` before building the response. That would guarantee the chain API always returns `exerciseBlocks` and string `reps`, consistent with the single-shot and extend APIs.

### 8.2 Reps type

- **Validation:** Allows `reps` as string or number. **Normalization:** `withRepsAsString` in `program-schedule-utils` ensures string when converting to `exerciseBlocks`. Downstream types expect `reps: string`. No bug found in the current UI path because the editor normalizes before save and before display.

### 8.3 Consistency across APIs

- **generate-program-chain:** Returns raw validated output (usually `blocks`).
- **generate-program** and **extend-program:** Return normalized output (`exerciseBlocks`, reps string).
- Normalizing in the chain response would align all three and reduce reliance on client-side normalization for the “save right after generate” path.

### 8.4 Documentation

- **ProgramSchedule** in `ai-program.ts` documents legacy vs canonical. **program-schedule-utils** is the single place for normalization and flattening; `getExercisesFromWorkout` is the single read path for “all exercises in a workout.” Keeping this contract avoids drift.

---

## 9. Summary Table

| Stage                     | Format accepted / produced         | Normalization                            |
| ------------------------- | ---------------------------------- | ---------------------------------------- |
| Mathematician prompt      | Teaches `blocks` (flat)            | —                                        |
| validateMathematician     | `blocks` or `exerciseBlocks`       | None                                     |
| generate-program-chain    | Returns normalized                 | `normalizeProgramSchedule` before return |
| generate-challenge-chain  | Returns normalized                 | `normalizeProgramSchedule` before return |
| generate-workout-chain    | Returns normalized                 | `normalizeWorkoutSet` before return      |
| generate-program          | Accepts both, returns normalized   | `normalizeProgramSchedule` before return |
| extend-program            | Returns normalized                 | `normalizeProgramSchedule` before return |
| Admin POST programs       | Normalized before write            | `normalizeProgramSchedule` in save       |
| Admin POST challenges     | Normalized before write            | `normalizeProgramSchedule` in save       |
| Admin POST workouts       | Normalized before write            | `normalizeWorkoutSet` in save            |
| ProgramBlueprintEditor    | Both; state is normalized          | `normalizeScheduleForEditor` on init     |
| getExercisesFromWorkout   | Both                               | N/A (read-only)                          |
| mapProgramWorkoutToArtist | Both (via getExercisesFromWorkout) | N/A (read-only)                          |

---

## 10. Post-Implementation (Schedule Normalization Module)

A single **schedule normalization module** ([src/lib/program-schedule-utils.ts](src/lib/program-schedule-utils.ts)) is the source of truth for canonical workout/schedule format across programs, challenges, and workout sets.

**Canonical format:** Workout has `exerciseBlocks` (no legacy `blocks`), and each exercise has `reps` as string.

**Where normalization is applied:**

1. **Generation API responses:** `generate-program-chain`, `generate-challenge-chain`, and `generate-workout-chain` normalize before returning, so all chain APIs return canonical shape.
2. **Persistence:** Admin POST handlers for programs, challenges, and workouts normalize in `saveProgramServer` / `saveChallengeServer` / `saveWorkoutServer` before writing to Firestore (defense in depth).
3. **Other APIs:** `generate-program` and `extend-program` already normalized before return; unchanged.
4. **Client:** ProgramBlueprintEditor still normalizes on init via `normalizeScheduleForEditor` for editor state and stable IDs.

**Functions:**

- `normalizeWorkoutForEditor(workout)` — single workout (legacy `blocks` → `exerciseBlocks`, reps → string).
- `normalizeProgramSchedule(program)` — object with `schedule` (weeks with workouts); used for programs and challenges.
- `normalizeWorkoutSet(set)` — object with `workouts` (flat array); used for workout sets.
- `getExercisesFromWorkout(workout)` — read-only flatten for display; accepts both formats.

Unit tests: [tests/lib/program-schedule-utils.test.ts](tests/lib/program-schedule-utils.test.ts).

This audit reflects the codebase as of the audit date; any later changes to the chain, validation, or normalization should be checked against this flow.
