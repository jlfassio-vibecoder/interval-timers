# Pre-Merge Report: Power Intervals Standalone App

**Branch:** feature/power-intervals-standalone  
**Scope:** `apps/power-intervals/` (new app), related docs  
**Review date:** Final gatekeeper pass

---

## Fixed (resolved in this PR or prior passes)

| Item | Type | Resolution |
|------|------|------------|
| **Race: empty `prev` in intensityData updater** | Critical | Guard added: `if (prev.length === 0) return prev` so interval tick never reads `prev[prev.length - 1]` before initial data is set. |
| **10 Hz React/Recharts re-renders** | Performance | Simulator interval reduced from 100ms to 250ms (4 Hz) to cut render load without changing architecture. |
| **Missing `font-display` Tailwind utility** | Logic | `fontFamily.display` added in `tailwind.config.js` so `font-display` applies Syncopate to blockquotes and non-heading elements. |
| **Missing `animate-zoom-in`** | Logic | `zoom-in` animation and keyframes added so modal zoom-in applies. |
| **Prose styling not applied** | Logic | `@tailwindcss/typography` added as devDependency and plugin so `prose prose-invert` works in protocol details modal. |
| **Warmup README inaccuracy** | Documentation | README updated: removed “28 filenames” and “each exercise wired to its image path”; now describes pattern-based selection via `WARMUP_IMAGE_MAP` in timer-core. |

---

## Slop scrubbed

| Finding | Action |
|---------|--------|
| Redundant comments | None found. Only comment in `src/` is the file-level JSDoc in `IntervalTimerSetupModal.tsx` (describes portal behavior); retained. |
| Hallucinated APIs | Verified: all imports from `@interval-timers/timer-core`, `@interval-timers/timer-ui`, `recharts`, and `react-dom` exist in the project. |
| Dead logic / placeholder code | None. `.catch(() => {})` on AudioContext resume/suspend/close kept intentionally to avoid unhandled promise rejections. |
| Unused variables | `_entry` in `impactData.map((_entry, index) => ...)` is an intentional unused param; pattern matches codebase. |
| TODO / FIXME / commented-out blocks | None in `apps/power-intervals`. |

---

## Ignored / not applied

| Suggestion / concern | Reason |
|----------------------|--------|
| Pause simulator when offscreen (e.g. IntersectionObserver) | Deferred to avoid scope creep; 250ms interval already reduces load. |
| Move intensity strip to canvas/SVG outside React state | Would be a large refactor; current approach is acceptable for this PR. |
| Remove `// https://vite.dev/config/` in vite.config.ts | Standard Vite scaffold; not AI slop; left as-is. |

---

## Security & boundaries

| Check | Result |
|-------|--------|
| **Env leakage** | No `import.meta.env` or `process.env` in `src/`. No `PUBLIC_` / client-exposed secrets. |
| **Node in client bundle** | `path` used only in `vite.config.ts` (build-time). No `fs`/`process`/`child_process` in `src/`. |
| **Error handling** | AudioContext resume/suspend/close use `.catch(() => {})` to avoid unhandled rejections; no silent swallowing of meaningful errors. |

---

## Build & lint

- **Build:** `npm run build -w power-intervals` — **pass**
- **Lint:** `npm run lint -w power-intervals` — **pass**

---

## Status

**READY TO MERGE**

The Power Intervals standalone app is consistent with existing patterns (e.g. Gibala, lactate-threshold), has no critical or slop issues identified in this pass, and passes build and lint. Remaining Copilot suggestions were either already applied in earlier turns or explicitly deferred (offscreen pause, canvas-based strip) to keep the PR focused.
