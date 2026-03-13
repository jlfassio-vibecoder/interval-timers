# SWOT Analysis: General AMRAP / Build Your Workout Flow

**Scope:** The full stepped workflow when a user selects "General AMRAP" from the protocol step: duration selection (5/15/20 min), then the exercise builder with qty/name inputs, and launch (blank timer or custom AMRAP).

**Components:** `useAmrapSetup`, `AmrapProtocolStep`, `AmrapBuildWorkoutStep`, `IntervalTimerSetupModal`, `AmrapInterval`

**Date:** March 13, 2026

---

## Current Behavior Summary

When the user opens the setup modal and selects **General AMRAP** (instead of a level: Beginner / Intermediate / Advanced):

1. **Protocol step:** User sees "General AMRAP" (description: "Pick your time cap (5 / 15 / 20 min)") and three level buttons.
2. **Duration step (Pick Time Cap):** Three options: Sprint (5 Mins), Standard (15 Mins), Endurance (20 Mins). Selecting one advances to the builder.
3. **Builder step (Build Your Workout):** 
   - "← Back to duration" link to return
   - Form: qty input (placeholder "15"), exercise name input (placeholder "burpees"), "+" add button
   - List of added exercises with qty, name, and remove (×) per item
   - "Launch Blank Timer" (if no exercises) or "Launch Custom AMRAP" (if exercises added)

**Data flow:** Exercises are stored as `{ qty, name }`; on launch they become `workoutList: string[]` in `"${qty} ${name}"` format (e.g. "15 burpees"). Duration comes from the selected time cap.

**Context:** This flow exists only in the Solo AMRAP path (`AmrapInterval`). The With Friends create flow uses `WorkoutPicker`, which has level → workout grid only—no General AMRAP / Build Your Workout option.

---

## Strengths

| Area | Description |
|------|-------------|
| **Clear two-step structure** | Duration first, then builder. Users choose time domain before designing exercises. Aligns with "how long" → "what to do" mental model. |
| **Flexible duration options** | Sprint (5), Standard (15), Endurance (20) cover common AMRAP time domains. Labels ("High intensity, zero rest", "Classic CrossFit time domain", "Pacing is critical") provide context. |
| **Custom from scratch** | Users can design any workout without being constrained by preset options. Supports open-ended programming. |
| **Blank timer path** | "Launch Blank Timer" when no exercises added—users can run a time cap with no structured round (e.g. open AMRAP, freeform work). |
| **Simple qty + name model** | Matches the `EXERCISE_REGEX` format used by volume display and results. Consistent with `workoutResults` and `AmrapExerciseList`. |
| **Back navigation** | "← Back to duration" and modal back button allow easy correction without starting over. |
| **Consistent protocol choice** | General AMRAP sits beside level buttons (Beginner, Intermediate, Advanced) as an alternative path. Clear separation of "custom" vs "curated". |
| **Reusable state management** | `useAmrapSetup` cleanly separates protocol selection, duration, and builder state. General build flow is isolated from level/workout flow. |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **Qty input is free text** | No validation for qty format. User can enter "10-12", "5m", "abc", or leave blank. Only `workoutResults` regex enforces structure; builder accepts anything. |
| **No reorder** | Exercises are added in sequence; no drag-to-reorder. Order is fixed. |
| **No templates or suggestions** | Unlike level path (library of preset workouts), General AMRAP offers no suggestions. Users must know what to type. |
| **Not available in With Friends** | `WorkoutPicker` used by With Friends create flow has no General AMRAP option. Only level → workout grid. Solo and Social paths diverge. |
| **Limited duration choices** | Only 5, 15, 20 minutes. No custom duration (e.g. 10 or 12 min). |
| **No exercise autocomplete** | Exercise name is free text. No suggestions or library lookup. Typos and inconsistent naming possible. |
| **Empty qty/name ambiguity** | User can add "15 " or " burpees" (partial). Trimmed values may produce "15 " or " burpees". Filter removes fully empty, but " " could slip through. |
| **No duplicate detection** | Same exercise can be added multiple times. No "you already have burpees" warning. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **General AMRAP in With Friends** | Add General AMRAP / Build Your Workout as an option in the With Friends create flow so hosts can design custom workouts for group sessions. |
| **Duration flexibility** | Add custom duration input (e.g. "Other" with number field) for 10, 12, 18 min, etc. |
| **Exercise suggestions** | Autocomplete or dropdown of common exercises from `AMRAP_WORKOUT_LIBRARY` or a shared list. |
| **Qty format hints** | Placeholder or helper text: "e.g. 10, 10-12, 5m". Validate before add and surface format errors. |
| **Templates** | "Start from template" with popular combos (e.g. "Cindy-style: 5 pull-ups, 10 push-ups, 15 air squats"). |
| **Reorder** | Drag-and-drop to reorder exercises. |
| **Duplicate detection** | Warn when adding an exercise that already exists (by normalized name). |
| **Recent workouts** | "Recent custom workouts" from localStorage for quick relaunch. |

---

## Threats

| Area | Description | Mitigation |
|------|-------------|------------|
| **Format mismatch** | Builder produces "15 burpees"; `workoutResults` / `AmrapExerciseList` expect `^\d+(?:-\d+)?|\d+m)\s+(.+)$`. Invalid formats show "—" in volume or break parsing. | Add format validation in builder; show inline error for invalid qty. |
| **Long workout lists** | Users can add many exercises. UI scrolls, but no cap. Copy format uses compact mode for > 6; builder has no limit. | Consider soft cap or warning at 10–12 exercises. |
| **Accessibility** | Form relies on qty/name inputs. Screen reader support depends on `aria-label`. No live region for add/remove feedback. | Add `aria-live` for list changes; ensure focus management after add. |
| **Mobile UX** | Small screens: form wraps, list scrolls. "+" button and inputs may be cramped. | Test on mobile; consider stacked layout or larger touch targets. |
| **State persistence** | If user closes modal mid-build, state is lost. No draft save. | Optional: persist `customExercises` + `selectedDuration` in sessionStorage for restore. |
| **Solo-only scope** | General AMRAP is Solo-only. Product evolution toward Social-first could leave this flow underused or orphaned. | Document; consider parity for With Friends. |

---

## Flow Diagram (Summary)

```
Protocol Step
├── General AMRAP → Duration (5/15/20) → Builder (qty + name, add/remove) → Launch
└── Beginner | Intermediate | Advanced → Workout Grid (presets) → Launch
```

---

## Recommendations

1. **Validate qty format** — Add inline validation for qty (`\d+`, `\d+-\d+`, or `\d+m`); show error state before add.
2. **General AMRAP in With Friends** — Expose Build Your Workout in the create flow so hosts can design custom group workouts.
3. **Duration flexibility** — Consider "Other" with custom minutes for power users.
4. **Exercise suggestions** — Autocomplete from library or a shared exercise list to reduce typos and standardize naming.
5. **Reorder support** — Add drag-and-drop if reordering is a common need.
