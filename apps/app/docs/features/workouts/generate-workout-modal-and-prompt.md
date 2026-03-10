# Workout Generator (Workout Factory) Modal — Full Specification

This document describes **only** the **Generate Workout** modal (Workout Factory): its UI, state, how every field becomes the API payload, and how that payload is used to build each step of the 4-step AI prompt chain. It does not describe the workout editor or any other screen.

---

## 1. The Workout Generator Modal — What It Is and Where It Lives

- **Component:** `src/components/react/admin/WorkoutGeneratorModal.tsx`
- **Purpose:** Create or regenerate a workout set (single or multi-session) from a “persona” (user profile and constraints). The user fills a config form, clicks “Generate Workout,” and the app runs a 4-step AI chain; then the user sees a preview and can save to library or (if editing) update the existing workout.
- **Where it is opened:**
  - From **Manage Workouts** (`src/components/react/admin/views/ManageWorkouts.tsx`): “Generate Workout” button.
  - From the workout edit page: “Regenerate with AI” opens the same modal for an existing workout (edit mode).

The modal has **three steps** (UI states):

1. **Config** — Form to fill (title, description, time/sessions, split, target persona, goals, equipment, medical, preferred focus).
2. **Generating** — Loading state with progress messages (“Step 1/4…”, “Step 2/4…”, etc.) while the API runs.
3. **Preview** — Generated workout set (title, description, list of sessions with exercises); actions: “Back to config,” “Save to Library” (or “Update Workout” in edit mode).

---

## 2. Modal Layout and State (Exact Detail)

### 2.1 Header

- **Title:** “Workout Factory” (config) or “Review Workouts” (preview); “Edit Workout” in edit mode.
- **Subtitle:** “Create a single or split workout set from persona” (config) or “Review and save your workout set” (preview).
- **Close:** X button; disabled while loading.

### 2.2 State Variables (All of Them)

| State                  | Type                           | Source / meaning                                                                          |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `step`                 | `'config' \| 'preview'`        | Current step; `'preview'` when there is `existingWorkout` or after a successful generate. |
| `workoutConfig`        | `WorkoutConfig`                | Full form config; initialized from `providedConfig` or `defaultConfig`.                   |
| `generatedWorkout`     | `WorkoutSetTemplate \| null`   | Result from the API after generate; shown in preview.                                     |
| `chainMetadata`        | `WorkoutChainMetadata \| null` | Raw Step 1–4 outputs and timestamp; set when generate succeeds.                           |
| `loading`              | boolean                        | True while the generate request is in flight.                                             |
| `loadingMessage`       | string                         | Progress text, e.g. “Step 1/4: Designing workout structure...”.                           |
| `chainStep`            | number                         | 0–4; used for progress dots.                                                              |
| `error`                | `string \| null`               | Validation or API error message.                                                          |
| `saveSuccess`          | boolean                        | Shown after save.                                                                         |
| `zones`                | `Zone[]`                       | Fetched on mount; options for Equipment dropdown.                                         |
| `selectedZone`         | `Zone \| null`                 | Currently selected zone in the Equipment section.                                         |
| `equipmentItems`       | `{ id, name }[]`               | All equipment items; used to display names for `selectedEquipmentIds`.                    |
| `selectedEquipmentIds` | `string[]`                     | Equipment IDs for the selected zone (or from config); used when building the persona.     |

`WorkoutConfig` (from `@/types/ai-workout`) contains:

- `workoutInfo`: `{ title, description }`
- `targetAudience`: `{ ageRange, sex, weight, experienceLevel }`
- `requirements`: `{ sessionsPerWeek, sessionDurationMinutes, splitType, lifestyle, twoADay, weeklyTimeMinutes }`
- `medicalContext`: `{ includeInjuries, injuries?, includeConditions, conditions? }`
- `goals`: `{ primary, secondary }`
- Optional: `zoneId`, `selectedEquipmentIds`, `preferredFocus`, `blockOptions`, `hiitMode`, `hiitOptions`

- **`blockOptions`** (optional): `BlockOptions` — `{ includeWarmup: boolean, mainBlockCount: 1 | 2 | 3 | 4 | 5, includeFinisher: boolean, includeCooldown: boolean }`. Controls whether the generated workouts include warmup, finisher, and cooldown blocks and how many main exercise blocks per workout. Used only when **HIIT mode is OFF**. Default when omitted: `includeWarmup: true`, `mainBlockCount: 1`, `includeFinisher: false`, `includeCooldown: false`.

- **`hiitMode`** (optional): When `true`, the form switches to Metabolic Conditioning (HIIT) mode: Block selectors are replaced by Metabolic Architecture, session duration uses HIIT tiers, Goals Primary uses HIIT goals, and the AI chain produces **Timer Schema** (workSeconds, restSeconds, rounds) instead of sets/reps.

- **`hiitOptions`** (optional): When `hiitMode` is true, holds `HiitOptions`: `protocolFormat`, `workRestRatio` (if standard_ratio), `circuitStructure` (includeWarmup, circuit1–3, includeCooldown), `sessionDurationTier`, `primaryGoal`. See §3.2b.

Default config (when no `providedConfig`): title/description empty; ageRange `'26-35'`, sex `'Male'`, weight `180`, experienceLevel `'intermediate'`; sessionsPerWeek `3`, sessionDurationMinutes `45`, splitType `'upper_lower'`, lifestyle `'active'`, twoADay `false`, weeklyTimeMinutes `180`; goals primary `'Muscle Gain'`, secondary `'Strength'`; medical toggles false; blockOptions as above; hiitMode false.

---

## 3. Config Form — Every Section and Field

The form is the only content when `step === 'config'` and not loading. Submit handler: `handleGenerate`.

### 3.1 Workout Information

- **Title \*** — Single line input.
  - Bound to: `workoutConfig.workoutInfo.title`
  - Placeholder: “e.g. Upper/Lower Split”
  - Required for submit (modal shows “Workout title is required” if empty).

- **Description \*** — Textarea, 2 rows.
  - Bound to: `workoutConfig.workoutInfo.description`
  - Placeholder: “Brief description of the workout set”
  - Required for submit (“Workout description is required” if empty).

### 3.1b HIIT Mode Toggle

- **Enable Metabolic Conditioning (HIIT) Mode** — Checkbox.
  - Bound to: `workoutConfig.hiitMode`. Default: false.
  - When checked, the following sections change: Block selectors are hidden and replaced by **Metabolic Architecture** (§3.2b); Session duration becomes a HIIT tier dropdown (§3.3); Goals Primary uses HIIT options (§3.5); Equipment shows an informational note.

### 3.2 Block selectors (when HIIT mode is OFF)

- **Include warmup block** — Checkbox.
  - Bound to: `workoutConfig.blockOptions.includeWarmup`. Default: true.

- **Main workout blocks** — Select, options 1–5.
  - Bound to: `workoutConfig.blockOptions.mainBlockCount`. Default: 1.

- **Include finisher block** — Checkbox.
  - Bound to: `workoutConfig.blockOptions.includeFinisher`. Default: false.

- **Include cool down block** — Checkbox.
  - Bound to: `workoutConfig.blockOptions.includeCooldown`. Default: false.

When `blockOptions` is missing on config, the modal uses the same defaults (e.g. from `defaultBlockOptions` in the component). These values determine how Step 4’s prompt and validation are built (warmup/finisher/cooldown task lines and per-workout validation).

### 3.2b Metabolic Architecture (when HIIT mode is ON)

Replaces Block selectors. All bound to `workoutConfig.hiitOptions` (defaults from `defaultHiitOptions`).

- **Protocol Format** — Dropdown: Standard Ratio (Work:Rest), Tabata Style (20:10), EMOM, AMRAP, Ladder, Chipper.
- **Work:Rest Ratio** — Dropdown, visible only when Protocol = Standard Ratio: 1:1 (Aerobic Power), 2:1 (Lactate Threshold), 1:2 (Phosphagen/Power), 1:3 (Recovery Focus).
- **Circuit Structure** — Multi-select checkboxes: Include Warmup (Ramp Up), Circuit 1 (The Driver), Circuit 2 (The Sustainer), Circuit 3 (The Burnout), Include Cool Down (Parasympathetic Reset).

Step 4 uses these to build circuit blocks and request **Timer Schema** (workSeconds, restSeconds, rounds) per exercise.

### 3.3 Time & Sessions

- **Weekly time (min) \*** — Number input, min 30, max 600.
  - Bound to: `workoutConfig.requirements.weeklyTimeMinutes`
  - Default from `defaultConfig`: 180.

- **Sessions per week \*** — Select, options 1–7.
  - Bound to: `workoutConfig.requirements.sessionsPerWeek`
  - Default: 3.

- **Session duration (min) \*** — When HIIT mode OFF: number input, min 15, max 180. When HIIT mode ON: dropdown (Micro-Dose 4–10 mins, Standard Interval 15–20 mins, High Volume 25–30 mins); value is stored as midpoint (7, 18, or 28) in `workoutConfig.requirements.sessionDurationMinutes` and tier in `workoutConfig.hiitOptions.sessionDurationTier`.
  - Default: 45 (standard); 18 (HIIT default tier).

- **Split type \*** — Select. Options (value → label):
  - `upper_lower` → “Upper/Lower”
  - `ppl` → “Push/Pull/Legs”
  - `full_body` → “Full Body”
  - `push_pull_legs` → “Push-Pull-Legs”
  - `bro_split` → “Bro Split”
  - `custom` → “Custom”  
    Bound to: `workoutConfig.requirements.splitType`. Default: `upper_lower`.

- **Lifestyle \*** — Select: Sedentary, Active, Athlete.
  - Bound to: `workoutConfig.requirements.lifestyle`. Default: `active`.

- **Two-a-day allowed** — Checkbox.
  - Bound to: `workoutConfig.requirements.twoADay`. Default: false.

- **Preferred focus (optional)** — Single line input.
  - Bound to: `workoutConfig.preferredFocus`
  - Placeholder: “e.g. upper push only”.

### 3.4 Target Persona

- **Age range \*** — Select: 18-25, 26-35, 36-45, 46-55, 56-65, 65+.
  - Bound to: `workoutConfig.targetAudience.ageRange`.

- **Sex \*** — Select: Male, Female, Other.
  - Bound to: `workoutConfig.targetAudience.sex`.

- **Weight (lbs) \*** — Number, min 50, max 500.
  - Bound to: `workoutConfig.targetAudience.weight`. Default: 180.

- **Experience \*** — Select: Beginner, Intermediate, Advanced.
  - Bound to: `workoutConfig.targetAudience.experienceLevel`.

### 3.5 Goals

- **Primary \*** — When HIIT mode OFF: Select Fat Loss, Strength, Muscle Gain, Endurance, General Fitness; bound to `workoutConfig.goals.primary`. When HIIT mode ON: Select VO2 Max (Aerobic Ceiling), Lactate Tolerance (The “Burn”), Explosive Power (Speed), Fat Oxidation (Metabolic Conditioning); bound to `workoutConfig.hiitOptions.primaryGoal`.
  - Default: “Muscle Gain” (standard); “Fat Oxidation” (HIIT).

- **Secondary \*** — Same standard list in both modes (Fat Loss, Strength, Muscle Gain, Endurance, General Fitness).
  - Bound to: `workoutConfig.goals.secondary`. Default: “Strength”.

### 3.6 Equipment (optional)

- **Dropdown** — Options: “None” plus each zone from `zones` (label = zone name, value = zone id).
  - On change: if a zone is selected, `getZoneById(id)` is called; then `setSelectedZone(zone)`, `setSelectedEquipmentIds(zone.equipmentIds)`, and `workoutConfig` is updated with `zoneId` and `selectedEquipmentIds`. If “None,” zone and equipment are cleared in state and config.

- **Display** — When a zone is selected, a box shows “Equipment:” followed by the names of equipment for `selectedEquipmentIds` (from `equipmentItems`), or “All in zone” if the list is empty.

- When HIIT mode is ON, a note is shown: “For HIIT, the AI deprioritizes heavy barbell setups and favors Dumbbells, Kettlebells, and Bodyweight for safety under fatigue.”

### 3.7 Medical (if present in UI)

If the modal includes medical toggles and text inputs:

- **Include injuries** — Boolean; when true, an injuries text field is used.
  - Stored in: `workoutConfig.medicalContext.includeInjuries` and `workoutConfig.medicalContext.injuries`.

- **Include conditions** — Boolean; when true, a conditions text field is used.
  - Stored in: `workoutConfig.medicalContext.includeConditions` and `workoutConfig.medicalContext.conditions`.

(If the current modal version does not show these, they still exist on `WorkoutConfig` and default to false/empty.)

### 3.8 Form Actions

- **Cancel** — Calls `onClose`; disabled while loading.
- **Generate Workout** — Submit; disabled while loading. Runs `handleGenerate`.

---

## 4. How the Modal Builds the API Payload: `buildPersona()`

On “Generate Workout,” the modal **does not** send `workoutConfig` as-is. It builds a **WorkoutPersona** with the function `buildPersona()` (in `WorkoutGeneratorModal.tsx`) and sends that as the request body.

**Exact mapping (every persona field and where it comes from):**

| Persona field            | Source                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `title`                  | `workoutConfig.workoutInfo.title.trim()`                                                                                           |
| `description`            | `workoutConfig.workoutInfo.description.trim()`                                                                                     |
| `demographics`           | `workoutConfig.targetAudience` (ageRange, sex, weight, experienceLevel)                                                            |
| `medical.injuries`       | If `workoutConfig.medicalContext?.includeInjuries` then `workoutConfig.medicalContext.injuries \|\| ''`, else `''`                 |
| `medical.conditions`     | If `workoutConfig.medicalContext?.includeConditions` then `workoutConfig.medicalContext.conditions \|\| ''`, else `''`             |
| `goals`                  | `workoutConfig.goals` (primary, secondary)                                                                                         |
| `zoneId`                 | `selectedZone?.id ?? workoutConfig.zoneId`                                                                                         |
| `selectedEquipmentIds`   | If `selectedEquipmentIds.length > 0` then `selectedEquipmentIds`, else `workoutConfig.selectedEquipmentIds`                        |
| `weeklyTimeMinutes`      | `workoutConfig.requirements.weeklyTimeMinutes`                                                                                     |
| `sessionsPerWeek`        | `workoutConfig.requirements.sessionsPerWeek`                                                                                       |
| `sessionDurationMinutes` | `workoutConfig.requirements.sessionDurationMinutes`                                                                                |
| `splitType`              | `workoutConfig.requirements.splitType`                                                                                             |
| `lifestyle`              | `workoutConfig.requirements.lifestyle`                                                                                             |
| `twoADay`                | `workoutConfig.requirements.twoADay`                                                                                               |
| `preferredFocus`         | `workoutConfig.preferredFocus` (optional)                                                                                          |
| `hiitMode`               | `workoutConfig.hiitMode` (optional)                                                                                                |
| `hiitOptions`            | When `hiitMode` is true: `workoutConfig.hiitOptions ?? defaultHiitOptions`; otherwise not sent.                                    |
| `blockOptions`           | When HIIT mode OFF: `workoutConfig.blockOptions ?? defaultBlockOptions`. When HIIT mode ON: not sent (structure from hiitOptions). |

**Request issued by the modal:**

- **Method:** POST
- **URL:** `/api/ai/generate-workout-chain`
- **Headers:** `Content-Type: application/json`
- **Body:** `JSON.stringify({ ...buildPersona(), blockOptions, hiitMode, hiitOptions })` — persona fields plus `blockOptions` (when standard mode), `hiitMode`, and `hiitOptions` (when HIIT mode).

The modal does **not** send `architectBlueprint`; that is an optional API feature to skip Step 1 (not used by the modal).

---

## 5. API: Validation and Zone/Equipment Resolution

**File:** `src/pages/api/ai/generate-workout-chain.ts`

- **Parse body** as `WorkoutPersona` (and optional `architectBlueprint`); if JSON is invalid, return 400.
- **Validate:**
  - `demographics`, `medical`, `goals` must be present.
  - `weeklyTimeMinutes`: number, 30–600.
  - `sessionsPerWeek`: number, 1–7.
  - `sessionDurationMinutes`: number; when **HIIT mode** (`hiitMode` true): 4–30; otherwise 15–180.
  - `splitType` and `lifestyle` required (string).
  - When `hiitMode` is true, `hiitOptions` is normalized (defaults applied if missing).  
    Any failure → 400 with error message.

- **Zone and equipment:**
  - If `persona.zoneId` is set: load zone via `getZoneByIdServer(persona.zoneId)` and load all equipment via `getAllEquipmentItemsServer()`.
  - **availableEquipment:** If the zone exists, use `persona.selectedEquipmentIds` if present (map IDs to names); otherwise use the zone’s `equipmentIds` (mapped to names). If the resulting list is empty, set to `['Bodyweight']`.
  - If no `zoneId` or zone not found: `availableEquipment` remains `['Bodyweight']`.
  - **zoneContext** (for Step 1 only): If zone exists, `{ zoneName: zone.name, availableEquipment, biomechanicalConstraints: zone.biomechanicalConstraints || [] }`. Otherwise Step 1 is called without zone context.

---

## 6. The 4-Step Prompt Chain — How Each Prompt Is Built

The API runs four steps in order. Each step calls Vertex AI with a **system prompt** (fixed) and a **user prompt** (built by a function). The model is instructed to return only valid JSON; the response is parsed, repaired if needed (`parseJSONWithRepair`), validated, and the result is passed to the next step.

---

### Step 1: Workout Architect

- **Purpose:** Design the high-level workout set: number of sessions, session names/focus/duration, split summary, progression protocol and rules, and volume landmarks (MEV/MRV per muscle group). No exercises yet. When **HIIT mode** is on, designs interval-based sessions with duration in the 4–30 minute range.

- **Prompt builder:** `buildWorkoutArchitectPrompt(persona, zoneContext?, hiitOptions?)` in `src/lib/prompt-chain/step1-workout-architect.ts`.

- **Arguments:**
  - `persona`: the full `WorkoutPersona` from the request.
  - `zoneContext`: optional `{ zoneName, availableEquipment, biomechanicalConstraints }` from the API (only if a zone was resolved).
  - `hiitOptions`: optional; when present (HIIT mode), the prompt includes a “METABOLIC CONDITIONING (HIIT) MODE” section with protocol format, work:rest ratio, circuit structure, session duration tier, and primary goal. The model is asked to output sessions with `duration_minutes` in the 4–30 range and may use `density_leverage` as progression_protocol.

- **How the user prompt is built:**
  - Destructures from `persona`: title, description, demographics, medical, goals, weeklyTimeMinutes, sessionsPerWeek, sessionDurationMinutes, splitType, lifestyle, twoADay, preferredFocus.
  - **Equipment section:** If `zoneContext` is present, appends:
    - `Equipment Zone: ${zoneContext.zoneName}`
    - `Available Equipment: ${zoneContext.availableEquipment.join(', ')}`
    - `Biomechanical Constraints: ${zoneContext.biomechanicalConstraints.join(', ')}`
      Otherwise the equipment section is empty.
  - **Medical section:** If `medical.injuries` or `medical.conditions` is non-empty, appends “Medical Context:” and “- Injuries: …” / “- Conditions: …” as appropriate; otherwise empty.
  - **Focus section:** If `preferredFocus` is set, appends “Preferred focus for single session: ${preferredFocus}”.
  - The rest of the prompt is a single template string that interpolates:
    - Title, description (or “(Auto-generate)” style placeholders).
    - Demographics: ageRange, sex, weight, experienceLevel.
    - Goals: primary, secondary.
    - Workout constraints: weeklyTimeMinutes, sessionsPerWeek, sessionDurationMinutes, splitType, lifestyle, twoADay.
    - Then the task (1–5) and the exact JSON output format (workout_set_name, rationale, sessions[], split, progression_protocol, progression_rules, volume_landmarks[]).
  - Final line: “Generate exactly the number of sessions that fit the user's sessionsPerWeek and splitType.”

- **Exact system prompt used by the API:**  
  `You are the Workout Architect (PhD Exercise Physiology). Output ONLY valid JSON.`

- **Model params:** temperature 0.5, maxTokens 2048.

- **Output:** Validated by `validateWorkoutArchitectOutput(data, hiitMode?)`. Must have: workout_set_name, rationale, sessions (1–7), split, progression_protocol, progression_rules, volume_landmarks. When `hiitMode` is true, `session_duration_minutes` and `sessions[].duration_minutes` are allowed to be as low as 4 (HIIT caps); otherwise minimum 10. This is the **Workout Architect blueprint**.

- **Passed to Step 2:** The API builds `architectForStep2` from the blueprint by adding `program_name: workoutArchitect.workout_set_name` (and keeping split, progression_protocol, progression_rules, volume_landmarks) so Step 2’s function gets the shape it expects.

---

### Step 2: Biomechanist

- **Purpose:** Map movement patterns (e.g. Horizontal Push, Knee Dominant) to each training day with category (compound/isolation/accessory) and priority (primary/secondary). Still no specific exercises.

- **Prompt builder:** `buildBiomechanistPrompt(architect)` in `src/lib/prompt-chain/step2-biomechanist.ts`.
  - **Argument:** `architect` = the adapted blueprint from Step 1 (`architectForStep2`).

- **How the user prompt is built:**
  - Single template string that interpolates:
    - Program: `architect.program_name`
    - Split type: `architect.split.type`
    - Days per week: `architect.split.days_per_week`
    - Session duration: `architect.split.session_duration_minutes`
    - Progression protocol and `architect.progression_rules.description`
    - Volume landmarks: one line per muscle group, “- {muscle_group}: {mev_sets}-{mrv_sets} sets/week”
  - Then the task (assign patterns for structural balance), pattern categories (UPPER/LOWER/ACCESSORIES), rules (push/pull balance, compound before isolation, etc.), and the exact JSON format: `days[]` with day_number, day_name, patterns[] (pattern, category, priority).
  - Final line: “Generate exactly ${architect.split.days_per_week} training days.”

- **Exact system prompt:**  
  `You are the Biomechanist. Map movement patterns for structural balance. Output ONLY valid JSON.`

- **Model params:** temperature 0.4, maxTokens 2048.

- **Output:** Validated by `validateBiomechanistOutput(data, workoutArchitect.split.days_per_week)`. Must have `days` array of length days_per_week; each day has day_number, day_name, patterns[] with pattern (string), category (compound|isolation|accessory), priority (primary|secondary). This is the **PatternSkeleton**.

---

### Step 3: Coach

- **Purpose:** For each pattern on each day, choose a **specific exercise** that fits the available equipment (e.g. “Horizontal Push” + Barbell → “Barbell Bench Press”). When **HIIT mode** is on, the prompt adds guidance to deprioritize heavy barbell and favor Dumbbells, Kettlebells, and Bodyweight.

- **Prompt builder:** `buildCoachPrompt(patterns, availableEquipment, hiitMode?)` in `src/lib/prompt-chain/step3-coach.ts`.
  - **Arguments:** `patterns` = Step 2’s PatternSkeleton; `availableEquipment` = string array of equipment names from the API; `hiitMode` = optional boolean; when true, a “HIIT / Metabolic Conditioning” note is appended to the equipment section.

- **How the user prompt is built:**
  - **AVAILABLE EQUIPMENT:** Either `availableEquipment.join(', ')` or “Bodyweight only (no equipment)” if the list is empty. If `hiitMode` is true, appends: “Deprioritize heavy barbell setups. Favor Dumbbells, Kettlebells, and Bodyweight for safety under fatigue.”
  - **PATTERN SKELETON:** For each day in `patterns.days`, a block “Day {day_number}: {day_name}” followed by lines “ - {pattern} ({category}, {priority})” for each pattern.
  - Then the task (fill each pattern with a specific exercise), examples (e.g. Horizontal Push + Barbell → Barbell Bench Press), rules (only use listed equipment, compound first, etc.), and the exact JSON format: `selections[]` with day_number, day_name, exercises[] (pattern, exercise_name, equipment_used, notes).
  - Final line: “Generate exercise selections for all ${patterns.days.length} days.”

- **Exact system prompt:**  
  `You are the Equipment Coach. Select specific exercises based on available equipment. Output ONLY valid JSON.`

- **Model params:** temperature 0.4, maxTokens 3072.

- **Output:** Validated by `validateCoachOutput(data, patterns.days.length)`. Must have `selections` array of length equal to number of days; each selection has day_number, day_name, exercises[] with pattern, exercise_name, equipment_used, notes. The validator returns this as **ExerciseSelection[]** (same shape, typed).

---

### Step 4: Workout Mathematician

- **Purpose:** Turn the Architect’s sessions and the Coach’s exercise list into full workouts: title, description, warmup blocks (optional), exercise blocks with **sets, reps, RPE, rest** (volume schema) or, when **HIIT mode** is on, **workSeconds, restSeconds, rounds** (timer schema), plus coach notes; optionally finisher and cooldown blocks. One workout per session.

- **Prompt builder:** `buildWorkoutMathematicianPrompt(architect, exercises, blockOptions, hiitMode?, hiitOptions?)` in `src/lib/prompt-chain/step4-workout-mathematician.ts`.
  - **Arguments:** `architect` = original Step 1 **WorkoutArchitectBlueprint**; `exercises` = Step 3’s **ExerciseSelection[]**; `blockOptions` = **BlockOptions** from the request (used when HIIT is off); `hiitMode` = optional boolean; `hiitOptions` = optional **HiitOptions**. When `hiitMode` and `hiitOptions` are set, effective block structure is derived from `hiitOptions.circuitStructure` (includeWarmup, number of circuits 1–3 from circuit1/2/3, includeCooldown, no finisher), and the prompt requests **Timer Schema** (workSeconds, restSeconds, rounds per exercise) with protocol and work:rest ratio in the prompt.

- **How the user prompt is built:**
  - **Protocol block:** “PROGRESSION PROTOCOL: …” and Architect’s rules. When HIIT, adds “HIIT / TIMER SCHEMA” with protocol and work:rest; task instructs to prescribe workSeconds, restSeconds, rounds and not use sets/reps for main work.
  - **SESSIONS FROM ARCHITECT** and **EXERCISES FROM COACH:** Same as standard.
  - **Task lines:** When HIIT, exerciseBlocks use “workSeconds, restSeconds, rounds, coachNotes”; block names can be “Circuit 1 (Driver)”, “Circuit 2 (Sustainer)”, “Circuit 3 (Burnout)”. Otherwise as before (sets, reps, rpe, restSeconds, coachNotes). Warmup/finisher/cooldown same shape in both modes.
  - Final line: “Output exactly ${sessionCount} workouts, one per session.”

- **Exact system prompt:**  
  When HIIT: `You are the Workout Mathematician. Generate one set of HIIT workouts with workSeconds, restSeconds, rounds per exercise. Output ONLY valid JSON.`  
  Otherwise: `You are the Workout Mathematician. Generate one set of workouts with sets, reps, RPE, rest. Output ONLY valid JSON.`

- **Model params:** temperature 0.3, maxTokens 8192, timeoutMs 120000.

- **Output:** Validated by `validateWorkoutMathematicianOutput(data, workoutArchitect.sessions.length, blockOptions, hiitMode?, hiitOptions?)`. Must have `workouts` array of that length. When **HIIT mode** is off: each exercise has exerciseName, sets, reps (and optional rpe, restSeconds). When **HIIT mode** is on: effective block options come from `hiitOptions.circuitStructure`; each main-block exercise must have exerciseName, workSeconds, restSeconds, rounds (Timer Schema). Warmup/finisher/cooldown requirements follow the effective options. This is **WorkoutInSet[]**. The modal preview renders Timer Schema as e.g. “40s work / 20s rest × 4 rounds” when those fields are present.

---

## 7. Final Assembly and Response to the Modal

- **Workout set:** `normalizeWorkoutSet({ title: persona.title || workoutArchitect.workout_set_name, description: persona.description || workoutArchitect.rationale, difficulty: persona.demographics.experienceLevel, workouts })` — so the set’s title/description come from the persona (modal) or fall back to the Architect’s name/rationale; difficulty from the persona’s experience level; workouts from Step 4.

- **Chain metadata:** `{ step1_workout_architect, step2_biomechanist, step3_coach, step4_workout_mathematician, generated_at, model_used: 'vertex-ai' }`.

- **Response body:** `{ workoutSet, chain_metadata }`. Status 200.

The modal then sets `generatedWorkout = data.workoutSet`, `chainMetadata = data.chain_metadata`, `step = 'preview'`, and shows the preview UI (title, description, workout count, each session’s title/description/exercises). The user can go “Back to config” or “Save to Library” / “Update Workout”; save uses `workoutConfig` and (when creating) `chainMetadata` as stored with the workout.

---

## 8. End-to-End Data Flow (Generator Only)

```
Modal config form
  → workoutConfig (all sections) + selectedZone / selectedEquipmentIds
  → buildPersona() → WorkoutPersona JSON
  → POST /api/ai/generate-workout-chain
     → Validate persona; resolve zone → zoneContext, availableEquipment
     → Step 1: buildWorkoutArchitectPrompt(persona, zoneContext) → user prompt
           → Vertex AI (system: Workout Architect, JSON only)
           → validate WorkoutArchitectOutput → blueprint
     → Step 2: buildBiomechanistPrompt(architectForStep2) → user prompt
           → Vertex AI (system: Biomechanist, JSON only)
           → validate BiomechanistOutput → PatternSkeleton
     → Step 3: buildCoachPrompt(patterns, availableEquipment) → user prompt
           → Vertex AI (system: Equipment Coach, JSON only)
           → validate CoachOutput → ExerciseSelection[]
     → Step 4: buildWorkoutMathematicianPrompt(workoutArchitect, exercises) → user prompt
           → Vertex AI (system: Workout Mathematician, JSON only)
           → validate WorkoutMathematicianOutput → WorkoutInSet[]
     → normalizeWorkoutSet(...) → WorkoutSetTemplate
     ← { workoutSet, chain_metadata }
  ← Modal sets generatedWorkout, chainMetadata, step = 'preview'
  → User sees preview; can save or go back to config.
```

---

## 9. File Reference

| What                                                                                      | File                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Modal UI, form, buildPersona, handleGenerate, handleSave                                  | `src/components/react/admin/WorkoutGeneratorModal.tsx` |
| API: validation, zone resolution, 4-step orchestration                                    | `src/pages/api/ai/generate-workout-chain.ts`           |
| Step 1 prompt builder + validator                                                         | `src/lib/prompt-chain/step1-workout-architect.ts`      |
| Step 2 prompt builder + validator                                                         | `src/lib/prompt-chain/step2-biomechanist.ts`           |
| Step 3 prompt builder + validator                                                         | `src/lib/prompt-chain/step3-coach.ts`                  |
| Step 4 prompt builder + validator                                                         | `src/lib/prompt-chain/step4-workout-mathematician.ts`  |
| Types: WorkoutPersona, WorkoutConfig, WorkoutArchitectBlueprint, WorkoutSetTemplate, etc. | `src/types/ai-workout.ts`                              |

This document does not describe the workout editor, the library list, or any other feature—only the Workout Generator modal and how it builds and uses the prompts for the 4-step chain.
