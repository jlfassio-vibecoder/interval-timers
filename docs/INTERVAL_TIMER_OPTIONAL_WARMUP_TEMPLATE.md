# Optional Warm-Up Template for Interval Timers

This document describes the pattern used in the **Tabata** interval timer to offer an *optional* Daily Warm-Up before the main protocol. Use it as a template to implement the same behavior in other timers (Aerobic, Japanese Walking, Lactate Threshold, Power Intervals/Phosphagen, Wingate, etc.) in a consistent way.

---

## 1. Overview

- **User journey**: User opens the timer’s setup flow, chooses whether to include the Daily Warm-Up or skip straight to the protocol, then starts the timer. The warm-up is never mandatory.
- **Behavior**: If “Include Warm-Up” is chosen, the timeline is prefixed with the shared warm-up block and the overlay receives warm-up exercise data. If “Skip” is chosen, the timeline starts with setup and no warm-up props are passed.
- **Reference implementation**: `apps/tabata/` (TabataInterval, useTabataSetup, TabataSetupContent, interval-timer-setup-data).

---

## 2. Data Model

### 2.1 Setup result type

Extend the timer’s setup result interface with an optional flag:

```ts
// In your app's setup-data file (e.g. interval-timer-setup-data.ts)
export interface YourProtocolSetupResult {
  // ... existing fields (e.g. cycles, workoutList, etc.)
  /** When true, prepend Daily Warm-Up block to the timer. Default false (skip). */
  includeWarmup?: boolean;
}
```

- **Naming**: Use `includeWarmup` for consistency.
- **Default**: Treat missing/undefined as `false` (skip warm-up).

---

## 3. Setup Hook

### 3.1 State

- Add `includeWarmup: boolean` state (default `false`).
- Reset it when opening the setup modal (e.g. in `open()`): `setIncludeWarmup(false)`.

### 3.2 Completion callbacks

- In every path that calls `onComplete(result)` (e.g. “Start with standard”, “Start with custom cycles/workout”), include the current `includeWarmup` value in `result`.
- Add `includeWarmup` to the dependency array of any `useCallback` that builds the result (e.g. `[onComplete, includeWarmup]`).

### 3.3 Return value

Expose for the protocol step UI:

- `includeWarmup`
- `setIncludeWarmup`

---

## 4. Protocol Step UI

### 4.1 Props

Add to the protocol step component:

- `includeWarmup: boolean`
- `onIncludeWarmupChange: (value: boolean) => void`

### 4.2 “Before you start” block

Render a “Before you start” section at the **top** of the protocol step (above “Standard” and any category buttons):

- **Heading**: e.g. “Before you start”
- **Short copy**: Explain that Daily Warm-Up prepares joints and muscles and is recommended before high-intensity work.
- **Two actions**:
  - “Include Warm-Up (~14 min)” → `onIncludeWarmupChange(true)`
  - “Skip, go straight to [Protocol Name]” → `onIncludeWarmupChange(false)`
- **Visual state**: Highlight the selected option (e.g. border/background for the chosen button; match existing modal styling like Tabata’s `#ffbf00` accent).

Reuse the same structure and class names as in `TabataSetupContent.tsx` (e.g. `rounded-xl border border-white/10 bg-black/20 p-4`) so behavior and layout stay consistent across timers.

---

## 5. Main Interval Component (e.g. XxxInterval.tsx)

### 5.1 Imports

Keep/restore:

- `useWarmupConfig`, `WarmupExercise` from `@interval-timers/timer-ui`
- `getDefaultWarmupBlock` from `@interval-timers/timer-core`

### 5.2 State

- **Frozen warm-up** (set only when user chose “Include Warm-Up” at setup):

  ```ts
  const [frozenWarmup, setFrozenWarmup] = useState<{
    exercises: WarmupExercise[];
    durationPerExercise: number;
  } | null>(null);
  ```

- Get live config: `const { exercises, durationPerExercise } = useWarmupConfig();`

### 5.3 Setup completion handler

In the setup hook’s `onComplete` callback:

- Set protocol-specific state (e.g. cycles, workout list) as you already do.
- Set warm-up from the result:
  - If `result.includeWarmup === true`:  
    `setFrozenWarmup({ exercises: [...exercises], durationPerExercise });`
  - Else:  
    `setFrozenWarmup(null);`
- Then open the timer (e.g. `setIsTimerOpen(true)`).

### 5.4 Timeline construction

- Build the timeline in a `useMemo`.
- **If** `frozenWarmup` is set, prepend `getDefaultWarmupBlock()`.
- Then add `getSetupBlock()` and the rest of the protocol blocks (work/rest/cooldown, etc.).
- Include `frozenWarmup` in the dependency array.

Example shape:

```ts
const timeline = useMemo<HIITTimelineBlock[]>(() => {
  const blocks: HIITTimelineBlock[] = [];
  if (frozenWarmup) {
    blocks.push(getDefaultWarmupBlock());
  }
  blocks.push(getSetupBlock());
  // ... append work/rest/cooldown blocks
  return blocks;
}, [/* protocol deps */, frozenWarmup]);
```

### 5.5 IntervalTimerOverlay

- **timeline**: The memoized timeline (with or without warm-up).
- **onClose**: Close the timer and clear frozen warm-up:  
  `() => { setFrozenWarmup(null); setIsTimerOpen(false); }`
- **warmupExercises**: `frozenWarmup?.exercises`
- **warmupDurationPerExercise**: `frozenWarmup?.durationPerExercise`

When the user skips warm-up, `frozenWarmup` is `null`, so the overlay receives `undefined` for those props and does not show warm-up UI.

### 5.6 Wiring the protocol step

Pass the warm-up props from the setup hook into the protocol step component:

- `includeWarmup={setup.includeWarmup}`
- `onIncludeWarmupChange={setup.setIncludeWarmup}`

---

## 6. Checklist for Another Timer

Use this when adding optional warm-up to another app (e.g. Aerobic, Japanese Walking, Lactate, Phosphagen, Wingate):

| Step | Item |
|------|------|
| 1 | Add `includeWarmup?: boolean` to the setup result type in the app’s setup-data file. |
| 2 | In the setup hook: add `includeWarmup` state, reset in `open()`, pass `includeWarmup` in every `onComplete(result)` and return `includeWarmup` and `setIncludeWarmup`. |
| 3 | In the protocol step component: add `includeWarmup` and `onIncludeWarmupChange` props; add the “Before you start” block at the top (Include / Skip buttons). |
| 4 | In the main interval component: add `frozenWarmup` state and `useWarmupConfig()`; in setup `onComplete`, set or clear `frozenWarmup` from `result.includeWarmup`. |
| 5 | Build timeline with optional `getDefaultWarmupBlock()` when `frozenWarmup` is set; include `frozenWarmup` in memo deps. |
| 6 | Pass `warmupExercises={frozenWarmup?.exercises}` and `warmupDurationPerExercise={frozenWarmup?.durationPerExercise}` to `IntervalTimerOverlay`; in `onClose`, call `setFrozenWarmup(null)` and close the timer. |
| 7 | Pass `includeWarmup` and `onIncludeWarmupChange` from the setup hook into the protocol step. |

---

## 7. Tabata Reference Files

| File | Role |
|------|------|
| `apps/tabata/src/components/interval-timers/interval-timer-setup-data.ts` | `TabataSetupResult.includeWarmup` |
| `apps/tabata/src/components/interval-timers/useTabataSetup.ts` | `includeWarmup` state, reset on open, passed in `onComplete`, returned for UI |
| `apps/tabata/src/components/interval-timers/TabataSetupContent.tsx` | “Before you start” block and `TabataProtocolStep` props |
| `apps/tabata/src/components/interval-timers/TabataInterval.tsx` | `frozenWarmup`, timeline with optional warm-up, overlay props, onClose clearing `frozenWarmup` |

---

## 8. Notes

- **No change to Daily Warm-Up app**: The standalone Daily Warm-up app and its landing entry are unchanged; this pattern only affects interval timers that optionally prepend the warm-up.
- **Shared warm-up definition**: Warm-up exercises and duration come from `@interval-timers/timer-core` (`getDefaultWarmupBlock`) and `@interval-timers/timer-ui` (`useWarmupConfig`). Changing the shared design updates all timers that use it.
- **Copy**: Adjust “Skip, go straight to [Protocol Name]” per timer (e.g. “Skip, go straight to Aerobic”, “Skip, go straight to Wingate”).
