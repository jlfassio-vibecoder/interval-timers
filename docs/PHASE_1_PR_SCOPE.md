# Phase 1 PR — Scope and Description

Use this for the PR title and description so the PR accurately reflects the changes.

---

## Suggested PR title

```
Phase 1: Monorepo restructure — packages, all-timers refactor, daily-warmup app
```

---

## Suggested PR description

**Phase 1 monorepo restructure**

This PR restructures the repo into a monorepo with shared packages and two apps (not just “initial project setup for all-timers”).

**Scope:**

- **Workspace:** Root `package.json` with `workspaces: ["apps/*", "packages/*"]` and root scripts for dev/build/lint.
- **Shared packages:** `packages/types`, `packages/timer-sounds`, `packages/timer-core`, `packages/timer-ui` — extracted from the original app so both apps can depend on them.
- **Apps:**
  - **all-timers:** Refactored to use `@interval-timers/*` packages; existing interval protocols and UI preserved.
  - **daily-warmup:** New standalone app (warm-up flow only), also using the shared packages.
- **Docs:** Monorepo commands (e.g. `docs/COMMANDS.md`), pre-PR checklist, and execution/scope docs.

**Not in scope:** Database resets, new features beyond the restructure, or Phase 2 work.
