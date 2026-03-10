# Warm-Up Timer: Use Only Execution Protocol (Replace Performance Cues)

## Goal

The Daily Warm-Up timer header should show **only** the deep dive’s **Execution Protocol** bulleted list (the numbered steps under “Execution Protocol” in each exercise’s deep dive). Do **not** use Performance Cues from biomechanics as the source for these instructions.

## Current Behavior

- **API** (`src/pages/api/warmup-config.ts`):
  1. For each slot with a linked `GeneratedExercise`, it tries **Execution Protocol** first: `extractExecutionProtocolFromDeepDiveHtml(ex.deepDiveHtmlContent)`.
  2. If Execution Protocol steps exist → `base.instructions = executionProtocolSteps`.
  3. **If Execution Protocol is empty**, it uses:
     - `slot.fallbackInstructions`, if present, otherwise
     - leaves `base.instructions` unset (no list shown in the header for that slot).
  4. Performance Cues (`ex.biomechanics?.performanceCues`) are **not** used by this API.

- **Parser** (`src/lib/parse-execution-protocol.ts`): Already extracts the first `<ol>` or `<ul>` after an “Execution Protocol” (or “Step-by-Step Instructions”) heading and returns an array of step strings (one per `<li>`, HTML stripped). No change needed for “every exercise has a deep dive” if the deep dive HTML follows the expected structure.

- **Overlay** (`IntervalTimerOverlay.tsx`): Renders `warmupList[idx].instructions` (first 3) as a bullet list in the header. It does not care whether those strings came from Execution Protocol or slot fallback. No UI change required; the API sends only Execution Protocol or slot fallback.

## Target Behavior

- **Instructions in the warm-up header** = **only**:
  1. **Execution Protocol** steps extracted from the linked exercise’s `deepDiveHtmlContent` (when present and parseable), or
  2. **Slot fallback**: `slot.fallbackInstructions` when there is no linked exercise, or when the linked exercise has no Execution Protocol (e.g. legacy content).
- **Remove** any use of `ex.biomechanics?.performanceCues` when building `base.instructions` in the warmup-config API. So Performance Cues are never shown in the warm-up header.

## Example of Execution Protocol (already supported)

The parser expects deep dive HTML like:

```html
<h2>Execution Protocol</h2>
<ol>
  <li>
    Quadruped Setup — Begin on all fours (hands under shoulders, knees under hips). Ensure your
    spine is neutral.
  </li>
  <li>
    Extension and Abduction — Extend one leg directly out to the side. The foot of the extended leg
    should be flat on the floor.
  </li>
  ...
</ol>
```

`extractExecutionProtocolFromDeepDiveHtml` returns one string per `<li>` (e.g. `["Quadruped Setup — Begin on all fours...", "Extension and Abduction — Extend one leg...", ...]`). The overlay shows the first 3 of these.

## Implementation

### 1. `src/pages/api/warmup-config.ts`

- In the block where `slot.generatedExerciseId` is set and `ex` is found:
  - Keep: compute `executionProtocolSteps` from `ex.deepDiveHtmlContent`; if `executionProtocolSteps.length > 0`, set `base.instructions = executionProtocolSteps`.
  - **Remove** the `else` branch that sets `base.instructions` from `ex.biomechanics?.performanceCues` or `slot.fallbackInstructions` when Execution Protocol is empty. Replace with: **only** set `base.instructions` from `slot.fallbackInstructions` when Execution Protocol is empty (so admins can still provide fallback text for exercises without a proper Execution Protocol section).
- Resulting logic in words:
  - If linked exercise has Execution Protocol steps → use those.
  - Else if slot has `fallbackInstructions` → use those.
  - Else → leave `base.instructions` unset (no list in header for that exercise).

No new dependencies or types. No changes to `parse-execution-protocol.ts`, `IntervalTimerOverlay.tsx`, or `useWarmupConfig.ts`.

### 2. Optional (out of scope for this change)

- **approved-exercise-maps.ts** still uses `performanceCues` for its own `instructions` (different feature). Do not change that in this task.
- If future deep dives use a different Execution Protocol format (e.g. step number + title + paragraph), the parser could be extended to return structured steps; for now, one string per `<li>` is sufficient.

## Files to Touch

| File                             | Change                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/api/warmup-config.ts` | Use only Execution Protocol or `slot.fallbackInstructions` for `base.instructions`; remove fallback to `ex.biomechanics?.performanceCues`. |

## Verification

- Run Daily Warm-Up with a slot linked to an exercise that has a deep dive with “Execution Protocol” and an `<ol>`/`<ul>`: header should show those steps (first 3).
- For a linked exercise with no Execution Protocol section (or empty list): header should show slot fallback if configured, or no bullets.
- Performance Cues should never appear in the warm-up header after this change.
