# Audit: Program Editor — Design and Workflow

**Date:** 2025-02-12  
**Scope:** Program Editor feature: entry points, components, data flow, validation, and persistence.

---

## 1. Overview

The "Program Editor" in the admin app refers to two related surfaces:

1. **Full-page Program Editor** — Route ` /admin/programs/:id`. Edit program metadata (title, description, difficulty, duration) and view (or replace) schedule; can open the generator modal to create/replace content with AI.
2. **Blueprint Editor flow** — The schedule/workout editor used inside **Program Generator Modal**: weeks → workouts → exercise blocks → exercises, with drag-and-drop, extend, and exercise mapping. This is the main place where admins edit the actual program schedule.

Both use the same underlying data shape (`ProgramTemplate` / `ProgramSchedule`) and share the **Program Generator Modal** for creation and for full schedule editing when launched from the Program Library.

---

## 2. Entry Points and Routing

| Entry point                    | Route / location                     | What opens                                                                                                                                                    |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manage Programs**            | Admin → Programs (list)              | Table of programs; "Edit" loads full program and opens **Program Generator Modal** in edit mode (preview step with ProgramBlueprintEditor).                   |
| **Program Editor (full page)** | Admin → Programs → `programs/:id`    | Full-page form (metadata + read-only schedule summary); "Generate with AI" opens **Program Generator Modal** in **create** mode (no existing program passed). |
| **New Program**                | Manage Programs → "Generate Program" | Opens **Program Generator Modal** in create mode (config step).                                                                                               |

**Routing** ([src/components/react/admin/AdminDashboard.tsx](src/components/react/admin/AdminDashboard.tsx)):

- `programs` → `ManagePrograms`
- `programs/:id` → `ProgramEditor`

---

## 3. Component Hierarchy

```text
ManagePrograms
  └── ProgramLibraryTable (list + Edit → fetchFullProgram, then open modal)
  └── ProgramGeneratorModal (existingProgram, editingProgramId, programConfig, editingChainMetadata)
        └── ProgramBlueprintEditor (initialData={generatedProgram}, onSave, onCancel, onDirtyChange)
        └── ChainDebugPanel (when chainMetadata present)

ProgramEditor (full page)
  └── Meta form (title, description, difficulty, durationWeeks) → updateProgram (client SDK)
  └── Schedule (read-only summary via getExercisesFromWorkout)
  └── ProgramGeneratorModal (no existingProgram; onGenerate merges result into page state)
```

**Reuse:** [ChallengeBlueprintEditor](src/components/react/admin/ChallengeBlueprintEditor.tsx) wraps **ProgramBlueprintEditor** for challenges (adds milestones section; same schedule editing).

---

## 4. Data Sources and Persistence

### 4.1 Two persistence paths

Programs are read/written in two ways:

| Path                               | Used by                                                | Read                                                                                             | Write                                                                                                    |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **API + program-persistence**      | ManagePrograms, ProgramLibraryTable, modal save/update | `fetchFullProgram(id)` → GET `/api/admin/programs/:id` (rehydrates master + week subcollections) | `saveProgramToLibrary` / `updateProgram` → POST/PUT `/api/admin/programs` (master + week subcollections) |
| **Client Firestore (programs.ts)** | ProgramEditor (full page)                              | `getProgramById(id)` — reads **master document only**                                            | `updateProgram(id, data)` — updates **master document only**                                             |

**Implication:** The full-page Program Editor uses [getProgramById](src/lib/firebase/admin/programs.ts) from the client SDK, which reads a single document. The admin API stores schedule in **week subcollections**, not on the master doc. So when opening `/admin/programs/:id` directly, the schedule may be missing or stale unless the master doc is populated elsewhere. The **Program Library** flow (Manage Programs → Edit) uses `fetchFullProgram`, which hits the API and returns the full schedule from subcollections.

### 4.2 Edit flow (Manage Programs)

1. User clicks Edit on a row in **ProgramLibraryTable**.
2. Table calls `fetchFullProgram(programId)` (program-persistence) → full `ProgramTemplate` with schedule.
3. Table calls `onEdit(fullProgram, programId)`.
4. **ManagePrograms** sets `editingProgram`, `editingProgramId`, fetches metadata via `fetchProgramMetadata(programId)`, builds `ProgramConfig`, sets `editingChainMetadata`, opens **ProgramGeneratorModal** with:
   - `existingProgram={fullProgram}`
   - `editingProgramId={programId}`
   - `programConfig={config}`
   - `editingChainMetadata={…}`
5. Modal opens at **preview** step with `generatedProgram = existingProgram`; **ProgramBlueprintEditor** receives `initialData={existingProgram}`.
6. On Save, modal calls `updateProgram(editingProgramId, editedProgram, programConfig, currentUser.uid)` (program-persistence → PUT API).

### 4.3 Full-page Program Editor flow

1. User is on `/admin/programs/:id`; **ProgramEditor** loads program via `getProgramById(id)` (client SDK, master doc only).
2. Renders meta form and schedule summary (using `getExercisesFromWorkout` per workout). No schedule editing on the page itself.
3. "Generate with AI" opens **ProgramGeneratorModal** **without** `existingProgram` / `editingProgramId` — so modal is in **create** mode (config → generate → preview).
4. When user saves in the modal, a **new** program is created via `saveProgramToLibrary`; modal calls `onGenerate(editedProgram)`.
5. **ProgramEditor**’s `onGenerate` merges the returned program into local state (form data + `program.schedule`). Page does not refetch; if user then clicks "Save Changes" on the page, it calls `updateProgram(id, …)` with the **current** URL `id` and the merged data (so the existing document is updated with the new content).

---

## 5. Program Generator Modal — Design

**File:** [src/components/react/admin/ProgramGeneratorModal.tsx](src/components/react/admin/ProgramGeneratorModal.tsx)

**Role:** Single modal for (1) creating new programs (multi-step: config → blueprint/architect → chain → preview) and (2) editing existing programs (opens at preview with ProgramBlueprintEditor).

**State:**

- `step`: `'config' | 'blueprint' | 'architect' | 'preview'` — in edit mode, initial step is `'preview'`.
- `generatedProgram` — the program being edited or just generated; passed to ProgramBlueprintEditor as `initialData`.
- `programConfig` — target audience, duration, goals, zone, etc.; used for save and for generation.
- `editingProgramId`, `editingChainMetadata` — set when editing an existing program; used for update vs create and for ChainDebugPanel.
- `hasUnsavedBlueprintChanges` — from ProgramBlueprintEditor `onDirtyChange`; used to guard close/cancel (confirm dialog).

**Key behaviors:**

- **Close / Cancel:** If there are unsaved blueprint changes, a confirm dialog is shown (stay / leave).
- **Save:** `handleSaveToLibrary(editedProgram)` — if `editingProgramId` then `updateProgram`, else `saveProgramToLibrary`; then toast, `onGenerate(editedProgram)`, and close after delay.
- **beforeunload:** If modal is open at preview with unsaved changes, browser beforeunload is prevented.

---

## 6. Program Blueprint Editor — Design

**File:** [src/components/react/admin/ProgramBlueprintEditor.tsx](src/components/react/admin/ProgramBlueprintEditor.tsx)

**Role:** Edit program title/description and full schedule: weeks → workouts → warmup blocks and exercise blocks → exercises. Handles normalization, validation, extend, drag-and-drop, and exercise mapping.

### 6.1 Props

- `initialData: ProgramTemplate` — program to edit (from modal’s `generatedProgram`).
- `onSave: (data: ProgramTemplate) => Promise<void>` — called with current program state (parent persists).
- `onCancel: () => void` — cancel/back.
- `onDirtyChange?: (isDirty: boolean) => void` — report dirty state (used for close guard and unsaved indicator).

### 6.2 Initialization and normalization

- State is initialized with `normalizeScheduleForEditor(initialData)`:
  - Runs `normalizeWorkoutForEditor` on every workout (legacy `blocks` → `exerciseBlocks`, reps to string).
  - Ensures each block and exercise has a stable `id` for React keys and DnD (`ensureStableIds`).
  - Ensures workout `description ?? ''`.
- Dirty check: baseline is `JSON.stringify(normalizeScheduleForEditor(initialData))`; whenever `program` state changes, compare to baseline and call `onDirtyChange(isDirty)`.

### 6.3 Data shape in state

- **Program:** `title`, `description`, `difficulty`, `durationWeeks`, `schedule`.
- **Schedule:** array of weeks; each week has `weekNumber`, `workouts`.
- **Workout:** `title`, `description`, `warmupBlocks[]`, `exerciseBlocks[]` (canonical; no legacy `blocks` in editor state).
- **Exercise block:** `id`, `order`, `name`, `exercises[]`.
- **Exercise:** `id`, `order`, `exerciseName`, `exerciseQuery`, `sets`, `reps`, `rpe`, `restSeconds`, `coachNotes`.

### 6.4 Actions (state updates)

- **Program:** `updateTitle`, `updateDescription`.
- **Workout:** `updateWeekWorkout(weekIndex, workoutIndex, 'title'|'description', value)`; `addWorkout(weekIndex)`; `removeWorkout(weekIndex, workoutIndex)`.
- **Warmup:** `updateWarmupBlock`, `addWarmupBlock`, `removeWarmupBlock`.
- **Exercise blocks:** `updateExerciseBlock(…, 'order'|'name', value)`; `addExerciseBlock`; `removeExerciseBlock`; `reorderExerciseBlocks` (DnD).
- **Exercises:** `updateExercise(…, field, value)`; `addExercise`; `removeExercise`; `reorderExercises` (DnD).

All updates are immutable (new schedule/workouts/blocks/exercises arrays); block and exercise stable `id`s are preserved where present.

### 6.5 Drag and drop

- **@dnd-kit:** `DndContext`, `SortableContext`, `verticalListSortingStrategy`; sensors with pointer and keyboard.
- **Sortable items:** Exercise blocks (within a workout) and exercise rows (within a block); each uses a stable `id` for the sortable handle.
- **handleDragEnd:** Resolves dragged/dropped ids to block indices or (blockIndex, exerciseIndex); calls `reorderExerciseBlocks` or `reorderExercises` accordingly.

### 6.6 Extend program

- If `program.schedule.length < program.durationWeeks`, a notice is shown and "Generate Missing N Week(s)" is available.
- **handleExtendProgram:** POST `/api/ai/extend-program` with `{ program, targetWeeks }`; response is normalized with `normalizeScheduleForEditor` and set as new program state.

### 6.7 Exercise mapping and preview

- **Approved maps:** On mount, loads approved generated exercises and builds `exerciseMap`, `extendedMap`, `slugMap` via `buildApprovedExerciseMaps` (used to show linked exercise info and open detail).
- **Map picker:** Per-exercise "Link" can open **ExerciseMapPickerModal** to set `exerciseQuery` (or similar) for that row; `mapPickerTarget` tracks which exercise is being mapped.
- **View exercise:** Clicking a mapped exercise can open **ExerciseDetailModal** with `previewExercise`, `previewExtended`, `previewSlug` from the approved maps.

### 6.8 Save and validation

- **handleSave:** Runs `validateWorkoutDescriptions(program.schedule)` (every workout must have non-empty `description`). If valid, calls `onSave(program)`; parent (modal) then persists. Errors are shown inline and via toast.

---

## 7. Validation

- **Workout descriptions:** [validate-program-schedule.ts](src/lib/validate-program-schedule.ts) — `validateWorkoutDescriptions(schedule)` ensures each workout has a non-empty `description`. Used by ProgramBlueprintEditor before save and by generate-program API.
- **ProgramBlueprintEditor** does not validate title/duration; modal and API may enforce those elsewhere.

---

## 8. Summary Diagram

```text
                    ┌─────────────────────────────────────────────────────────┐
                    │                  Program Editor entry points             │
                    └─────────────────────────────────────────────────────────┘
                      │                                    │
                      ▼                                    ▼
            ┌──────────────────┐                ┌──────────────────────┐
            │  Manage Programs │                │ ProgramEditor (page) │
            │  (programs list)  │                │   /admin/programs/:id │
            └────────┬─────────┘                └──────────┬───────────┘
                     │ Edit (fetchFullProgram)              │ getProgramById
                     │ then open modal                      │ "Generate with AI"
                     ▼                                      ▼
            ┌─────────────────────────────────────────────────────────────────┐
            │              ProgramGeneratorModal                               │
            │  existingProgram? → preview step ; else → config step            │
            │  generatedProgram → ProgramBlueprintEditor (initialData)         │
            │  onSave → updateProgram | saveProgramToLibrary (program-persistence) │
            └─────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
            ┌─────────────────────────────────────────────────────────────────┐
            │              ProgramBlueprintEditor                               │
            │  init: normalizeScheduleForEditor(initialData) + ensureStableIds   │
            │  state: program (title, description, schedule)                   │
            │  actions: update workout/block/exercise, add/remove, reorder DnD  │
            │  extend: POST /api/ai/extend-program                              │
            │  save: validateWorkoutDescriptions → onSave(program)              │
            │  modals: ExerciseMapPickerModal, ExerciseDetailModal              │
            └─────────────────────────────────────────────────────────────────┘
```

---

## 9. Files Reference

| Area                    | File                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Full-page editor        | [src/components/react/admin/views/ProgramEditor.tsx](src/components/react/admin/views/ProgramEditor.tsx)       |
| Program list + Edit     | [src/components/react/admin/views/ManagePrograms.tsx](src/components/react/admin/views/ManagePrograms.tsx)     |
| Library table           | [src/components/react/admin/ProgramLibraryTable.tsx](src/components/react/admin/ProgramLibraryTable.tsx)       |
| Generator modal         | [src/components/react/admin/ProgramGeneratorModal.tsx](src/components/react/admin/ProgramGeneratorModal.tsx)   |
| Blueprint editor        | [src/components/react/admin/ProgramBlueprintEditor.tsx](src/components/react/admin/ProgramBlueprintEditor.tsx) |
| Schedule validation     | [src/lib/validate-program-schedule.ts](src/lib/validate-program-schedule.ts)                                   |
| Schedule normalization  | [src/lib/program-schedule-utils.ts](src/lib/program-schedule-utils.ts)                                         |
| Persistence (API)       | [src/lib/firebase/admin/program-persistence.ts](src/lib/firebase/admin/program-persistence.ts)                 |
| Client SDK (master doc) | [src/lib/firebase/admin/programs.ts](src/lib/firebase/admin/programs.ts)                                       |
| Admin routes            | [src/components/react/admin/AdminDashboard.tsx](src/components/react/admin/AdminDashboard.tsx)                 |

---

## 10. Notes and Potential Improvements

1. **Full-page Program Editor data:** It uses `getProgramById` (client SDK, master doc only). If programs are stored with schedule in week subcollections only, the full-page editor may show empty or outdated schedule. Consider using `fetchFullProgram(id)` from program-persistence when opening the page so schedule is loaded from the API.
2. **Full-page + modal:** From the full-page editor, the modal is opened without `existingProgram` / `editingProgramId`, so it always creates a new program on save. To "edit this program’s blueprint" from the full page, the page could pass `existingProgram={program}`, `editingProgramId={id}`, and a reconstructed `programConfig` so the modal opens in edit mode and updates the same document.
3. **Challenge editor:** ChallengeBlueprintEditor reuses ProgramBlueprintEditor for schedule editing and adds a milestones section; the same workflow and normalization apply to challenges.

This audit reflects the codebase as of the audit date.
