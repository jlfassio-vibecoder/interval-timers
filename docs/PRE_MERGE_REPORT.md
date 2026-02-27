# Pre-Merge Report

**Date:** Final PR gatekeeper pass  
**Scope:** Phase 4 Aerobic + Lactate Threshold standalone apps, deploy script, Vercel rewrites, Copilot comment triage, anti-slop scrub

---

## Fixed

| Area | Fix |
|------|-----|
| **Docs** | COMMANDS.md: Clarified that only amrap and lactate-threshold are in `build:deploy`; added note that aerobic, tabata, japanese-walking, daily-warmup are not in the pipeline yet and paths like `/aerobic-timer` are served by the all-timers SPA. |
| **Asset paths** | lactate-threshold: Moved sounds README from `public/README.md` to `public/sounds/README.md` so contributors add assets where `@interval-timers/timer-sounds` expects them (`/sounds/...`). |
| **Asset paths** | lactate-threshold: Moved warmup docs from `public/warmup/` to `public/images/warmup/` so paths match `timer-core` (`WARMUP_IMAGES_BASE = '/images/warmup'`) and align with aerobic app. |
| **Error handling** | LactateInterval.tsx: `audioContextRef.current?.suspend()` now uses `?.catch(() => {})` to avoid unhandled Promise rejections when the context is already closed or suspend fails. |

---

## Slop Scrubbed

- **Redundant comments:** None found in aerobic or lactate-threshold apps; no obvious “setting X to Y” or redundant JSDoc in changed files.
- **Hallucinated APIs:** All imports and method calls in new/edited files verified; no non-existent utilities or wrong parameters.
- **Dead logic:** No placeholder logic, unused variables, or redundant try/catch in the PR scope. `console.error` in catch blocks (e.g. AmrapInterval) are intentional and kept.

---

## Ignored

| Suggestion | Reason |
|------------|--------|
| **vercel.json:** Add rewrites for `/aerobic-timer` | Aerobic is intentionally not part of the merged deploy yet; documented in COMMANDS.md. Adding rewrites without building/copying aerobic would 404. |
| **package.json:** Include aerobic in `build:deploy` | Same decision: aerobic not in pipeline yet. Copilot’s “build:deploy builds aerobic” was incorrect—aerobic is not in the script. |
| **scripts/copy-amrap-to-dist.cjs:** Add aerobic to `copies` | Same decision: aerobic omitted by design until it is added to the full deploy flow. |
| **MISSING_IMAGES path “this folder”** (public/warmup) | Already resolved by moving content to `public/images/warmup/`; file at `public/warmup/MISSING_IMAGES.md` no longer exists. |

---

## Verification

- **Env:** Only `import.meta.env.VITE_APP_URL` used in client code (all-timers); aerobic and lactate-threshold use no env in client. No secrets or non-`VITE_` env in `src/`.
- **Node APIs:** `fs`/`path` only in config and `scripts/copy-amrap-to-dist.cjs`; not in client components.
- **Lint:** No linter errors on LactateInterval.tsx or other touched files.
- **Structure:** lactate-threshold `public/` now matches aerobic (sounds/, images/warmup/); no stray `public/warmup/` or top-level sound README.

---

## Status

**READY TO MERGE**

All triaged Copilot comments have been addressed or explicitly declined with documented rationale. Critical fix applied (suspend Promise handling); doc and asset paths aligned with timer-core and existing apps. Aerobic remains out of the deploy pipeline by design until a follow-up change adds it to build, copy script, and rewrites.
