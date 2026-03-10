# ExerciseDetailModal — opened from WorkoutDetailModal

**File:** `src/components/react/ExerciseDetailModal.tsx`  
**Role:** The modal that opens when the user selects an exercise from the workout detail view (e.g. by clicking an exercise card inside WorkoutDetailModal). It shows exercise details: images, video, instructions, and "Additional Tactical Data" (extended biomechanics when available). **The same component is used for both WODs (HUB/AppIslands) and Workouts (Active Program, Program Sales)** — same props; only the parent and data source differ.

---

## 1. How it is opened from WorkoutDetailModal

1. User has **WorkoutDetailModal** open (a workout is selected — either a WOD or a program workout).
2. User clicks an **ExerciseCard** in one of the phases (warmup, main, finisher, cooldown).
3. The card calls **`onSelectExercise?.(exerciseName)`** (prop provided by the parent that hosts WorkoutDetailModal).
4. The parent (**AppIslands**, **ActiveProgramView**, or **ProgramSalesView**) handles that in its `onSelectExercise` handler: it resolves the exercise data (WOD overrides / approved exercises / warmup blocks / static data as applicable), sets **`selectedExercise`** (and **`selectedExerciseExtendedBiomechanics`**, **`selectedExerciseSlug`** when available), and renders **ExerciseDetailModal** with those props.
5. **ExerciseDetailModal** appears on top of WorkoutDetailModal (z-index 140 vs 120).

So the modal that opens when the user "selects an exercise" in the workout-detail flow is **ExerciseDetailModal**, and it is the same modal in all contexts (WODs and Workouts).

---

## 2. Props (same in WOD and Workout flows)

| Prop                   | Type                                        | Description                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercise`             | `Exercise \| null`                          | The exercise to display. When non-null, the modal renders; when null, it returns null. Set by the parent when the user clicks an exercise card.                                                                                                     |
| `onClose`              | `() => void`                                | Called when the user closes the modal (X button or backdrop click). Parent typically clears `selectedExercise`, extended biomechanics, and slug.                                                                                                    |
| `extendedBiomechanics` | `ExtendedBiomechanics \| null \| undefined` | Optional. When present with content, the "Additional Tactical Data" stacked modal shows biomechanical chain, pivot points, stabilization, common mistakes; when null or empty, the button still appears and the stacked modal shows an empty state. |
| `exerciseSlug`         | `string \| null \| undefined`               | Optional. When set (e.g. from approved generated exercise), the modal shows a "View full page" link to `/exercises/:slug`.                                                                                                                          |

The parent is responsible for resolving the **Exercise** object (and optional extended biomechanics and slug) from the **exercise name** (string) passed by WorkoutDetailModal's `onSelectExercise`. **AppIslands** (WODs): WOD-specific overrides → approved exercises from `generated_exercises` → static data. **ActiveProgramView** (Workouts): approved exercises → warmup block → static data. **ProgramSalesView** uses the same prop interface with its own resolution.

---

## 3. Integration with WorkoutDetailModal and parents (WODs vs Workouts)

- **WorkoutDetailModal** does not render ExerciseDetailModal itself. It only receives **`onSelectExercise`** and passes it to each **ExerciseCard**. The same WorkoutDetailModal and the **same ExerciseDetailModal** are used for WODs and for Workouts; the parent (AppIslands, ActiveProgramView, or ProgramSalesView) provides `onSelectExercise` and renders ExerciseDetailModal with the same props: `exercise`, `onClose`, `extendedBiomechanics`, `exerciseSlug`.
- **AppIslands** (WODs): passes **`onSelectExercise={handleSelectExercise}`** to WorkoutDetailModal, resolves exercise from overrides → approved → static, sets `selectedExercise` / `selectedExerciseExtendedBiomechanics` / `selectedExerciseSlug`, and renders **ExerciseDetailModal** with those props.
- **ActiveProgramView** (Workouts): same pattern; resolves from approved → warmup block → static and passes the same four props to ExerciseDetailModal.
- **ProgramSalesView**: same prop interface; resolution and state live in that component.
- **Z-index:** ExerciseDetailModal uses `z-[140]` (and inner overlays 150), above WorkoutDetailModal's `z-[120]`, so it stacks on top when both are open. Closing ExerciseDetailModal returns focus to WorkoutDetailModal.

---

## 4. UI/UX and SEO audit — recommendations

The component is in good shape: `useReducedMotion`, descriptive image `alt` text, backdrop and close-button dismissal, and sanitized HTML for instructions and extended biomechanics. The following are optional improvements.

### Accessibility and keyboard

- **Focus management (implemented):** Focus is trapped in both the main dialog and the stacked "Additional Tactical Data" dialog. On open, focus moves to the first focusable (e.g. close button); Tab/Shift+Tab loops within the active dialog. When the main modal closes, focus is restored to the element that opened it (typically the ExerciseCard). When the stacked modal closes, focus returns to the "Additional Tactical Data" button. Both dialogs use `role="dialog"` and `aria-modal="true"` (and `aria-labelledby` for the title).
- **Escape to close (implemented):** The main modal closes on Escape and restores focus to the trigger. The stacked "Additional Tactical Data" modal closes on Escape first (its keydown listener uses capture phase and `stopPropagation` so the main modal does not close); focus then returns to the "Additional Tactical Data" button. A second Escape closes the main modal.

### Layout and performance

- **Image layout shift (mitigated):** Nominal `width` and `height` (640×360, 16:9) are set on each exercise `<img>` so the browser reserves space before load; the wrapper's `aspect-video` / `md:h-80` and `object-cover` are unchanged. If the app later provides per-image dimensions (e.g. from an API), those can be used instead.

- **Lazy loading (implemented):** Each exercise `<img>` uses `loading="lazy"` so images below the fold in the scrollable column are deferred until near the viewport.
- **Video error state (implemented):** When the video fails to load, `VideoPlayer` shows a fallback ("Video unavailable" and icon) inside the same wrapper so the broken player is not shown; error state resets when `videoUrl` changes.

### SEO

- **Indexability (addressed):** Canonical indexable pages exist at `/exercises/:slug` (and `/exercises/:slug/learn` for deep dives); they are server-rendered and included in the sitemap. When the modal displays an exercise that has a slug (e.g. from the approved generated list), a "View full page" link points to the canonical URL so users and crawlers can discover it; the modal remains the in-context UX layer.
- **Semantics:** The modal uses a clear heading hierarchy for outline and accessibility: the exercise name is an `<h2>` (dialog title, referenced by `aria-labelledby`); "Deployment Steps" is an `<h3>`. The nested "Additional Tactical Data" dialog uses `<h3>` for its title and `<h4>` for section titles (Biomechanical Chain, Pivot Points, etc.). This avoids a second `<h1>` on the host page and gives the dialog a single top-level heading.
- **Structured data:** There is no JSON-LD (e.g. `HowTo`, or exercise-related schema) for this content. Structured data belongs on server-rendered pages (the learn page has HowTo + ExerciseAction; the canonical slug page could be enhanced separately).

---

## 5. Related docs

- [WorkoutDetailModal](../WorkoutDetailModal.md) — parent modal that shows the workout and exercise list.
- [AppIslands](../AppIslands.md) — describes how WorkoutDetailModal is wired and how `onSelectExercise` is implemented to open this modal.
