# Plan: Phase duration sum as source of truth for Target Volume and Window

## Goal

Use the **sum of individual phase durations** (warmup, main, finisher, cooldown) as the source of truth for **Target Volume** and **Window** in the workout detail modal (and when generating/saving WODs). This ensures the displayed total always matches what the phases add up to (e.g. 8 + 27 + 5 + 5 = 45 minutes).

## Current behavior (incorrect)

- **Target Volume** and **Window** come from `workout.targetVolumeMinutes` and `workout.windowMinutes`, which are set in the generate-wod API from **parameters.timeDomain?.timeCapMinutes ?? 45** (a single time-cap value), not from the phase blocks.
- Each phase has its own `duration` string (e.g. "8 Minutes", "27 Minutes", "5 Minutes") displayed in the phase header; these are not summed anywhere.
- Result: the hero can show "45:00" and "45 Minutes" while the phases might total a different value (e.g. 10 + 25 + 5 + 5 = 45 by coincidence, or 8 + 27 + 5 + 5 = 45), or the opposite—phases total 50 but Target Volume shows 45.

## Approach

1. **Parse phase duration strings to minutes** with a small, shared helper (e.g. "8 Minutes" → 8, "27 Minutes" → 27, "—" or unparseable → 0).
2. **In the modal:** Compute total minutes from the **displayed** phase entries (same list used for the timeline); use that sum for Target Volume and Window when the sum &gt; 0; otherwise fall back to `workout.targetVolumeMinutes` / `workout.windowMinutes` (and finally to 45) so program workouts with "—" durations still show a sensible value.
3. **In the generate-wod API:** After building `workoutDetail`, compute the sum of the four blocks’ parsed durations and set `targetVolumeMinutes` and `windowMinutes` on the returned WOD to that sum (fallback to timeCapMinutes when sum is 0). So newly generated and saved WODs store the phase-based total.
4. **No change to Firestore schema or WODEngine save payload**—they already pass through `targetVolumeMinutes` and `windowMinutes`; the API will now send the correct values.

---

## Implementation

### 1. Shared helper: parse phase duration string to minutes

**New file:** `src/lib/parse-phase-duration.ts` (or add to an existing small util if preferred)

- **Function:** `parsePhaseDurationMinutes(duration: string): number`
- **Logic:** Extract the first contiguous sequence of digits from `duration` and return it as a number. If there is no number, or the string is empty/whitespace/only "—", return 0.
- **Examples:** "8 Minutes" → 8, "27 Minutes" → 27, "5 min" → 5, "—" → 0, "" → 0, "10:00" → 10.
- **Export** the function for use in the modal and in the API.

### 2. WorkoutDetailModal: derive Target Volume and Window from phase sum

**File:** `src/components/react/WorkoutDetailModal.tsx`

- After building `phaseEntries` (and `phaseCount`), compute:
  - `totalMinutesFromPhases = phaseEntries.reduce((sum, entry) => sum + parsePhaseDurationMinutes(entry.block.duration), 0)`.
- **Target Volume (hero):** Use `totalMinutesFromPhases > 0 ? totalMinutesFromPhases : (workout.targetVolumeMinutes ?? 45)` and display as `${value}:00`.
- **Window (Mission Parameters):** Use the same logic and display as `${value} Minutes`.
- **Rest Load:** No change; keep `workout.restLoad ?? 'Compressed'`.
- **Import** `parsePhaseDurationMinutes` from the new util.

Result: For any workout (static, generated, or program), the modal shows the sum of the phases when those phases have parseable durations; otherwise it falls back to stored or 45.

### 3. generate-wod API: set targetVolumeMinutes and windowMinutes from phase sum

**File:** `src/pages/api/ai/generate-wod.ts`

- After `const workoutDetail: WorkoutDetail = prescriberValidation.data`, compute the total minutes from the four blocks:
  - Sum `parsePhaseDurationMinutes(workoutDetail.warmup.duration)` + same for main, finisher, cooldown.
- Set `targetVolumeMinutes` and `windowMinutes` on the `wod` object to this sum when it is &gt; 0; otherwise keep current fallback `parameters.timeDomain?.timeCapMinutes ?? 45`.
- **Import** `parsePhaseDurationMinutes` from the shared util (ensure the API can import from `@/lib/...` or relative path as used elsewhere in the project).

Existing saved WODs that have the old values (e.g. 45) will still open in the modal; the modal will now **override** that with the sum of phases when phases are present and parseable, so old data will also show the correct total without a data migration.

### 4. Optional: recompute on save in WODEngine

**File:** `src/components/react/admin/views/WODEngine.tsx`

- When building the payload for `createGeneratedWOD`, you could optionally compute `targetVolumeMinutes` and `windowMinutes` from `generatedWOD.workoutDetail` (sum of the four block durations) instead of passing through `generatedWOD.targetVolumeMinutes` / `generatedWOD.windowMinutes`. That would make the saved document consistent even if the API response were ever out of sync. This is **optional** and can be a follow-up; the API + modal changes are sufficient for consistency.

---

## Files to add/change (summary)

- **Add:** `src/lib/parse-phase-duration.ts` — `parsePhaseDurationMinutes(duration: string): number`.
- **Edit:** `src/components/react/WorkoutDetailModal.tsx` — compute `totalMinutesFromPhases` from `phaseEntries`, use it for Target Volume and Window with fallback.
- **Edit:** `src/pages/api/ai/generate-wod.ts` — compute sum from `workoutDetail` and set `targetVolumeMinutes` / `windowMinutes` on the returned WOD.

No changes to types (Artist/GeneratedWODDoc already have optional `targetVolumeMinutes` / `windowMinutes`). No change to Firestore rules or wod-service mapping.

---

## Edge cases

- **Program workouts** (e.g. map-program-workout-to-artist): phases often have `duration: '—'`. Sum will be 0; modal falls back to `workout.targetVolumeMinutes ?? 45` (or stored value). So program workouts still show a reasonable default.
- **Malformed duration:** If a phase has a non-numeric duration, `parsePhaseDurationMinutes` returns 0; that phase does not contribute to the sum. If all phases are unparseable, sum is 0 and we use the fallback.
- **Empty phase list:** If `phaseEntries` is empty (no valid phases), `totalMinutesFromPhases` is 0; use fallback.

---

## Verification

- **Unit test (optional):** Add a small test for `parsePhaseDurationMinutes` (e.g. "8 Minutes" → 8, "—" → 0, "10 min" → 10).
- **Manual:** Open a workout whose phases have durations (e.g. 8 + 27 + 5 + 5 = 45). Confirm hero shows "45:00" and Mission Parameters show "45 Minutes". Change one phase duration in static data and confirm the total updates. Open a program workout with "—" and confirm fallback (e.g. 45) still shows.
- **Generate WOD:** Generate a new WOD, save it, and confirm the saved document has `targetVolumeMinutes` and `windowMinutes` equal to the sum of the four phase durations shown in the UI.
