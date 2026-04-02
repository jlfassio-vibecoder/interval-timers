# Roadmap: Astro 6 and @astrojs adapters v10

This document outlines a **future** upgrade path from **Astro 5** + **@astrojs/node / @astrojs/vercel v9** to **Astro 6** + **adapter v10**, aligned across the monorepo. It is a planning artifact only; implementation should follow the official Astro upgrade guide at the time of work.

## Why this upgrade

- **Security and maintenance**: npm audit often flags `@astrojs/node` / `@astrojs/vercel` below v10; those releases target **Astro 6** and are not compatible with Astro 5.
- **Correct pairing**: Adapter **v10** imports APIs such as `sessionDrivers` from `astro/config` that exist only when **Astro 6** is installed. Installing adapter v10 on Astro 5 causes runtime failures when loading `astro.config.mjs` (e.g. dev server / build).
- **Long-term**: Staying on supported major lines reduces drift and simplifies CI and dependency overrides.

## Current baseline (reference)

| Area | Notes |
|------|--------|
| Primary app | `apps/app`: SSR, Node + Vercel adapters, React, Tailwind, `@vite-pwa/astro`, many `src/pages/api/**` endpoints |
| Other Astro workspaces | `apps/recovery-pwa`, `apps/japanese-walking`, `apps/bio-sync-sixty` (Astro 5 today) |
| Monorepo guardrails | Root `package.json` **overrides** pin `@astrojs/node` and `@astrojs/vercel` to v9–compatible versions so `npm audit fix --force` cannot silently pull v10 while Astro remains on 5 |

## Goals

1. Upgrade **Astro** to **v6** where the project uses Astro.
2. Upgrade **@astrojs/node** and **@astrojs/vercel** to **v10** (or whatever the Astro 6 peer range requires at upgrade time).
3. Align **@astrojs/react**, **@astrojs/tailwind**, **@astrojs/check**, and tooling (**eslint-plugin-astro**, **prettier-plugin-astro**) with Astro 6.
4. Preserve behavior: SSR, API routes, auth/cookies, Vercel deploy, standalone Node (`server.js` / preview).
5. Resolve or replace **@vite-pwa/astro** if it does not yet support Astro 6 (common integration risk).

## Non-goals (for this migration)

- Rewriting product features unrelated to the framework upgrade.
- Database resets or schema changes (not required for an Astro major bump).

## Phases

### Phase 0 — Preparation

- [ ] Assign an owner and a target window (e.g. dedicated branch + staging deploy).
- [ ] Read the official **Astro v5 → v6** upgrade guide and changelog for breaking changes.
- [ ] Inventory all workspaces that depend on `astro` (grep `"astro":` in `**/package.json`).
- [ ] Document current deploy paths: Vercel (`VERCEL=1`), local `astro dev`, `astro build` + `server.js` for Node standalone.
- [ ] Decide **scope**: upgrade **only `apps/app`** first vs **all Astro apps** in one pass (see “Monorepo considerations”).

### Phase 1 — Dependency alignment (single branch)

- [ ] Bump `astro` to `^6.x` (exact minimum per official guide).
- [ ] Bump `@astrojs/node` and `@astrojs/vercel` to versions that **peer** Astro 6 (v10 line as of early planning).
- [ ] Bump `@astrojs/react`, `@astrojs/tailwind` to Astro-6–compatible majors.
- [ ] Bump `@astrojs/check`, `astro-eslint-parser`, `eslint-plugin-astro`, `prettier-plugin-astro` as needed.
- [ ] Verify **@vite-pwa/astro** (or alternative) supports Astro 6; pin or replace if blocked.
- [ ] **Root `overrides`**: remove or narrow `@astrojs/node` / `@astrojs/vercel` pins that force v9 once Astro 6 is in use; ensure no workspace resolves mismatched adapter majors.

### Phase 2 — Configuration and runtime

- [ ] Update `apps/app/astro.config.mjs` for any renamed options, adapter options, or Vite SSR settings per v6 guide.
- [ ] Re-validate **dual adapter** pattern (`@astrojs/node` vs `@astrojs/vercel` via `VERCEL` env) still matches adapter v10 docs.
- [ ] Review **`server.js`** (and any custom middleware) for changes to how the Node adapter exports `handler` / `startServer`.
- [ ] Re-run **PWA** generation and confirm service worker + precache behavior in staging.

### Phase 3 — Application verification

- [ ] `npx astro check` in each upgraded app.
- [ ] `npm run build` and `npm run test` in `apps/app` (and other upgraded workspaces).
- [ ] Manual smoke tests: auth, HUD, trainer routes, invite flows, critical API routes (Stripe, AI, invitations).
- [ ] Deploy to **staging** on Vercel; smoke test production build.
- [ ] If using **standalone Node**, run preview / production mode locally against built output.

### Phase 4 — Rollout and cleanup

- [ ] Merge to main with clear PR description (versions, breaking changes encountered, PWA notes).
- [ ] Update **CI** / **verify** scripts if commands or env assumptions changed.
- [ ] Optional: run `npm audit` and document any remaining issues that require separate upgrades (e.g. transitive dev-only chains).

## Monorepo considerations

| Strategy | Pros | Cons |
|----------|------|------|
| **Upgrade `apps/app` only** | Smaller blast radius | Root overrides may need to stay split (v9 for legacy Astro apps, v10 for app) until all move |
| **Upgrade all Astro workspaces together** | One Astro major, simpler overrides and mental model | More files and apps to test in one PR |

Recommendation: prefer **one Astro major across all workspaces** that ship Astro, unless a secondary app is rarely released and can be pinned on 5 for a short time with explicit overrides and a follow-up ticket.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **Adapter / Astro mismatch** | Always upgrade Astro and adapters in the **same** PR; follow peer dependency ranges. |
| **PWA integration lag** | Check `@vite-pwa/astro` compatibility early in Phase 1; have a fallback (temporarily disable PWA in dev, or pin a fork) documented. |
| **Large API surface** | Allocate time for endpoint and cookie regression tests; use staging. |
| **npm audit --force** | Document for the team: do **not** use `--force` for this repo until Astro 6 is merged, or overrides will fight audit. |

## Effort estimate (order of magnitude)

- **Narrow** (single app, integrations cooperate): roughly **0.5–2 days** engineering + QA.
- **Typical** (monorepo alignment, PWA tweaks, full staging): **2–5 days** including QA and deploy verification.

## Success criteria

- [ ] `astro build` and `astro dev` succeed for all upgraded apps.
- [ ] No dependency on Astro 5–only APIs without replacements.
- [ ] Staging deploy matches pre-upgrade behavior for critical flows.
- [ ] Root overrides updated so v9 pins are removed where obsolete, and audit strategy is documented.

## References (update when implementing)

- [Astro documentation](https://docs.astro.build) — upgrade guide and adapter docs for the target v6 release.
- Peer dependency ranges printed by `npm install` / `npm ls` when versions are mismatched.

---

*Last drafted: 2026-04-02. Revisit dependency versions and the official migration guide before starting implementation.*
