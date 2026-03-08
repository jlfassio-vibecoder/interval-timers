# Best Way: Add Interval Timers as Working Landing Pages and Timers

## Recommended approach

**One Astro route** (`/interval-timers`) **plus one React shell** (`IntervalTimerApp`) that renders **11 protocol components** (Tabata, Mindful, Aerobic, etc.) by page state. All components live in `src/components/react/interval-timers/` (migrated from the former `apps/interval-app` reference).

- **Landing pages:** Each timer component _is_ the landing page (hero, science, simulator, CTA) plus the full-screen timer.
- **Links:** Main nav "Interval Timers" → `/interval-timers`. Use **URL param** `?protocol=emom` so links can open a specific timer (e.g. `/interval-timers?protocol=tabata`).
- **Navigation between protocols:** Each component has its own nav bar (Tabata, Mindful, Aerobic, …); switching calls `onNavigate('emom')` and updates state. No full page reload.

---

## Step 1: One route, one shell (already in place)

- **Route:** `src/pages/interval-timers/index.astro` → mounts `IntervalTimerApp` with `client:load`.
- **Shell:** `src/components/react/interval-timers/IntervalTimerApp.tsx` → `useState(currentPage)` and renders one of the 11 components.
- **Nav:** Site nav already has "Interval Timers" → `/interval-timers`.

---

## Step 2: Source of truth

- **Components:** `src/components/react/interval-timers/*.tsx` — migration from the former `apps/interval-app` reference is complete; the reference app has been removed.

---

## Step 3: Repeatable process for each of the 11 components

For each component in `src/components/react/interval-timers/` (e.g. `MindfulWalking.tsx`, `EmomInterval.tsx`, …):

1. **Copy** the file to `src/components/react/interval-timers/<SameName>.tsx`.

2. **Fix imports**
   - No `./components/X` or `../components/X`. All timer components live in the same folder, so use `./TabataInterval`, `./MindfulWalking`, etc.
   - Keep `react` and `recharts` as-is (recharts is already a dependency in the Astro app).

3. **Fix types/lint**
   - Replace `(window as any).webkitAudioContext` with  
     `(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext`.
   - Replace `useState<any[]>([])` with a proper type (e.g. `{ time: number; value: number }[]` for chart data).
   - Fix any other `any` or lint errors.

4. **Fix Tailwind/custom classes**
   - If the component uses classes from the interval-app’s Tailwind config (e.g. `text-sync-orange`, `bg-sync-base`), replace with standard Tailwind classes (e.g. `text-orange-600`, `bg-gray-50`) so it works in the Astro app without adding new theme keys.

5. **Optional: canvas “blank” fix**
   - If the component has a canvas animation (e.g. Oxygen Debt Visualizer, Breath Pacer), use the same pattern as TabataInterval:
     - Start the loop in `useLayoutEffect` (not `useEffect`).
     - When `canvasRef.current` or `getContext('2d')` is null, call `requestRef.current = requestAnimationFrame(animateFn)` and `return` so the loop retries instead of stopping.

6. **Wire into IntervalTimerApp**
   - Add: `import MindfulWalking from './MindfulWalking';` (or the current component).
   - Add a branch: `{currentPage === 'mindful' && <MindfulWalking onNavigate={handleNavigate} />}`.
   - Remove or narrow the “Timer coming soon” fallback for that page.

7. **Test**
   - Run `npm run dev`, open `/interval-timers`, choose the protocol from the in-page nav (or open `/interval-timers?protocol=mindful`), confirm landing and timer both work.

---

## Step 4: Deep links (URL param)

- In `IntervalTimerApp`, on mount, read `protocol` from the URL (e.g. `?protocol=emom`).
- If it’s one of the 11 valid values, set initial state: `setCurrentPage(protocol)`.
- Then links from the main site or a hub can point to e.g. `/interval-timers?protocol=emom` and open that timer directly.

---

## Step 5: Order of operations

1. **TabataInterval** – Already in `src/components/react/interval-timers/`; Oxygen Debt Visualizer fix (useLayoutEffect, reschedule on null) already applied. Verify it works at `/interval-timers` and `/interval-timers?protocol=tabata`.
2. **Add URL param support** in `IntervalTimerApp` so `?protocol=` sets the initial page.
3. **Add remaining protocols** one by one (MindfulWalking, AerobicPower, LactateThreshold, PhosphagenPower, GibalaMethod, WingateProtocol, TimmonsMethod, EmomInterval, AmrapInterval, TenTwentyThirty), apply Steps 3.1–3.6 for each, then test.

---

## Summary

| What you want           | How it works                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Working landing pages   | Each of the 11 components is the landing (hero, science, simulator) + timer.          |
| Working interval timers | Same components; “Launch Timer” opens the full-screen countdown.                      |
| Links                   | “Interval Timers” in nav → `/interval-timers`. Use `?protocol=emom` for direct links. |
| One codebase            | All 11 live in `src/components/react/interval-timers/`; one Astro page.               |
| Source of truth         | All components in `src/components/react/interval-timers/`.                            |

No second app in production. One route, one shell, 11 components.
