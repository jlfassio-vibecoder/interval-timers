# Pre-Merge Report — AMRAP Programs PR

**Branch:** updates/amrap-programs  
**Reviewer:** Senior Lead Engineer (Final PR Gatekeeper)  
**Date:** 2026-03-01

---

## Phase 1–2 Summary

- **Critical / security / logic:** Checked; no vulnerabilities, race conditions, or improper error handling in changed files. No `import.meta.env` or `process.env` in client code; no Node-only APIs (`fs`, `path`, `child_process`) under `apps/amrap/src` or `apps/landing`.
- **AI slop:** Scanned for redundant comments, hallucinated APIs, and dead logic. None found; existing comments are JSDoc, file-level context, or intentional “why” notes.
- **Performance / idioms:** No changes needed; no heavy or non-idiomatic patterns introduced.
- **Style / architecture:** Changes match existing patterns (e.g. Tabata setup modal, `@/` alias, Recharts/Plotly usage).

---

## Fixed

| Item | Location | Resolution |
|------|----------|------------|
| General AMRAP path did not open time-cap picker | `AmrapInterval.tsx` (setup callback) | On `result.type === 'general'`, call `setIsDurationSelectOpen(true)` after scroll so “Pick your time cap (5 / 15 / 20 min)” is honored. |
| Trailing-slash URL could 404 for Programming Guide | `vercel.json` | Added rewrite `"source": "/amrap/programming-guide/", "destination": "/amrap/index.html"`. |

---

## Slop Scrubbed

- **Redundant comments:** None. Comments present are:
  - JSDoc on props/interfaces (AmrapCtaButton, AmrapSetupContent, amrap-setup-data).
  - File-level block comments (IntervalTimerSetupModal, useAmrapSetup, amrap-setup-data).
  - Single “why” comment in AmrapInterval for opening the time-cap picker (retained as intentional).
- **Hallucinated APIs:** None. Verified:
  - `react-plotly.js` default export `Plot` used with `data`, `layout`, `config`, `style`, `useResizeHandler` (matches `react-plotly.d.ts` and library).
  - Recharts (LineChart, PieChart, RadarChart, Tooltip, Legend, etc.) and react-router-dom (Routes, Route, Link, BrowserRouter) used correctly.
- **Dead logic / placeholders:** None. No unused variables, redundant try/catch, or TODO/FIXME/HACK in changed files.

---

## Ignored

- **Replacing all AMRAP rewrites with a single history-fallback rule:** Ignored. Repo uses explicit rewrites per route and per app; minimal fix was adding the missing trailing-slash rule only.
- **Moving time-cap selection into the setup modal:** Ignored. General AMRAP was wired to the existing time-cap picker for minimal churn and consistency with current UX.

*(No Copilot suggestions were discarded as “hallucinated” or “false positive” in this pass.)*

---

## Status

**READY TO MERGE**

- Security and env/Node boundaries are clean.
- No slop, dead code, or hallucinated APIs in the diff.
- Prior fixes (General AMRAP → time-cap picker, `vercel.json` trailing slash) are in place and consistent with existing patterns.
- Build and lint were previously verified; no new debt (TODO/FIXME/commented-out blocks) introduced.
