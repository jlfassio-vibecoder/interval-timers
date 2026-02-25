# Pre-PR Checklist

Use this checklist before opening a PR. It is tailored to this project’s stack: **Vite 7**, **React 19**, **TypeScript**, and **Tailwind CSS**.

---

## Vite + React boundaries

- **Env leakage:** No server-only or secret values reach the client. In Vite, only variables prefixed with `VITE_` are exposed via `import.meta.env`. Ensure no API keys, secrets, or non-`VITE_` env vars are used in client code (e.g. in `src/`).
- **Node in browser bundle:** Code under `src/` must not import Node-only modules (e.g. `fs`, `path`, `child_process`) unless they are behind conditional builds or used only in config/tooling. Vite config and other root config files can use Node APIs.
- **Path alias:** Use the `@/` alias for app code (e.g. `@/components/...`, `@/lib/...`) so imports stay consistent and build resolves correctly.

---

## @git (diff) review guidelines

Review only the changed lines. **Do not explain what the code does.** Flag only the following:

### Security

- Exposed API keys, secrets, or tokens (including any `import.meta.env` usage that could send non-public config to the client).
- Sensitive or full user/data objects logged to the console (or other client-visible logging).

### Cruft

- Leftover `console.log`, `console.debug`, or `console.info` (unless intentionally kept for a documented reason).
- Commented-out code blocks that are no longer needed.
- Unresolved `TODO`, `FIXME`, or `HACK` comments that should be tracked or removed.

### Regressions

- Logic that contradicts existing patterns in the same file or in the same feature (e.g. different error handling, state shape, or component structure without a clear reason).
- TypeScript types weakened or removed (e.g. `any` introduced, interfaces removed) without justification.
- Accessibility or semantics regressions (e.g. removing labels, focus handling, or ARIA where they were previously used).

---

## Quick checklist (copy before each PR)

- [ ] No secrets or non-`VITE_` env vars in client code
- [ ] No Node-only modules imported in `src/`
- [ ] Diff reviewed for: Security · Cruft · Regressions
- [ ] No stray console logs, commented-out code, or unresolved TODOs in changed files
- [ ] Changes align with existing patterns and types in the codebase
