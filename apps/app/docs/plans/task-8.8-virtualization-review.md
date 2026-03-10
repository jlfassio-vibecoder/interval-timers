# Task 8.8: Optional performance (virtualization) — Review and recommendation

## Recommendation: **Do not implement** at this time

Virtualizing the right column (e.g. with react-window) is **unnecessary** for the current WorkoutDetailModal and data model. Keep the existing DOM structure unless profiling later shows scroll jank.

---

## Rationale

### 1. Data shape and scale

- **Phases:** WorkoutDetail has a **fixed set of four phases** (warmup, main, finisher, cooldown). The modal only renders phases that pass validation and have content, so the right column has **at most 4 phase blocks**.
- **Exercises:** Each phase has an `exercises: string[]` array. In practice, WODs have on the order of ~5–20 exercises per phase (e.g. warmup 3–5, main 8–15, finisher 3–8, cooldown 3–5). **Total exercise cards are typically ~20–50**, not hundreds.

### 2. When virtualization helps

- Virtualization (react-window, react-virtualized, etc.) is most useful when list lengths are **large** (hundreds or thousands of items) so that only a small window of items is in the DOM. With a few dozen items, the cost of virtualization (complexity, dependency, variable-height handling) usually outweighs the benefit.

### 3. Doc’s own condition

- The doc (WorkoutDetailModal.md 8.8) says: _"consider virtualizing ... **only if profiling shows scroll jank**; **otherwise keep the current DOM structure for simplicity**."_ There is no indication that scroll jank has been observed; the task is explicitly optional and conditional.

### 4. Complexity cost

- The right column is **variable-height**: each phase has a header, duration badge, and a grid of ExerciseCards. Virtualizing variable-height content requires either fixed/estimated row heights or a more involved setup (e.g. VariableSizeList). That adds a dependency (react-window is not in package.json today) and maintenance burden without a proven performance problem.

---

## If you later see scroll jank (implementation outline)

Only consider this **after** profiling (e.g. Chrome DevTools Performance, React Profiler) shows that scrolling the right column is a bottleneck.

1. **Add dependency:** e.g. `react-window` (or `@tanstack/react-virtual` for a more flexible API).
2. **Identify the scroll container:** The right column is the `div` with `space-y-16 lg:col-span-8` inside the modal’s grid. That div (or a wrapper) would need a fixed height and `overflow-y: auto` so the virtual list can measure and scroll.
3. **Choose virtualization strategy:**
   - **Option A:** Virtualize by **phase block** (each phase is one “row”). Then each phase’s exercise grid stays as-is inside the virtualized row. Simpler; 4 rows is still small, so benefit is limited.
   - **Option B:** Virtualize the **flat list of phase + exercise items** (phase header, then N exercise cards, then next phase, etc.). Requires normalizing the list and variable-height support; higher complexity.
4. **Measure again:** After implementation, re-profile to confirm scroll jank is gone and that there’s no regression in other metrics.

Until profiling shows a real problem, the current structure is the right tradeoff: simple, no extra dependencies, and adequate for the actual data size.
