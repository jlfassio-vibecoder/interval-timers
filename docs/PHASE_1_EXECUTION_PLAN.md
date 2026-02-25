# Phase 1 Execution Plan: Root Restructure and Rename

## Current State

```
interval-timers/                          ← workspace root (parent folder)
├── docs/
│   └── PRE_PR_CHECKLIST.md
├── interval-timer-standalone/            ← GIT REPO ROOT (has .git)
│   ├── .git
│   ├── .gitignore
│   ├── README.md
│   ├── dist/
│   ├── index.html
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   ├── public/
│   ├── src/
│   ├── eslint.config.js
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
└── package-lock.json                     ← parent-level (empty workspace)
```

**Key**: `.git` lives in `interval-timer-standalone/`. `docs/` is at parent level (outside the repo). The goal is to make `interval-timers/` the repo root with `apps/`, `docs/`, and workspace config.

---

## Target State

```
interval-timers/                          ← NEW GIT REPO ROOT
├── .git                                  ← moved up from interval-timer-standalone
├── .gitignore
├── package.json                          ← new root workspace config
├── docs/
│   └── PRE_PR_CHECKLIST.md
└── apps/
    └── all-timers/                       ← current app (moved + renamed)
        ├── .gitignore
        ├── README.md
        ├── index.html
        ├── package.json                  ← name: "all-timers"
        ├── public/
        ├── src/
        ├── eslint.config.js
        ├── postcss.config.js
        ├── tailwind.config.js
        ├── tsconfig.json
        ├── tsconfig.app.json
        ├── tsconfig.node.json
        └── vite.config.ts
```

---

## Execution Steps (Order Matters)

### Step 1: Create `apps/` and `apps/all-timers/`

From workspace root (`interval-timers/`):

```bash
mkdir -p apps/all-timers
```

### Step 2: Move App Files into `apps/all-timers/`

Move everything from `interval-timer-standalone/` **except** `.git`, `node_modules`, and `dist`:

```bash
cd interval-timers

# Core app files
mv interval-timer-standalone/src apps/all-timers/
mv interval-timer-standalone/public apps/all-timers/
mv interval-timer-standalone/index.html apps/all-timers/

# Config files
mv interval-timer-standalone/vite.config.ts apps/all-timers/
mv interval-timer-standalone/tsconfig.json apps/all-timers/
mv interval-timer-standalone/tsconfig.app.json apps/all-timers/
mv interval-timer-standalone/tsconfig.node.json apps/all-timers/
mv interval-timer-standalone/tailwind.config.js apps/all-timers/
mv interval-timer-standalone/postcss.config.js apps/all-timers/
mv interval-timer-standalone/eslint.config.js apps/all-timers/

# Package files
mv interval-timer-standalone/package.json apps/all-timers/
mv interval-timer-standalone/package-lock.json apps/all-timers/

# Optional
mv interval-timer-standalone/README.md apps/all-timers/
mv interval-timer-standalone/.gitignore apps/all-timers/
```

**Do not move**: `node_modules/`, `dist/` (will be regenerated), `.git/` (handled in Step 3).

### Step 3: Move `.git` to Repo Root

```bash
mv interval-timer-standalone/.git .
```

This makes `interval-timers/` the new git root. Git will now track files at `apps/all-timers/...` instead of `src/...` at root.

### Step 4: Remove Empty `interval-timer-standalone/`

```bash
rm -rf interval-timer-standalone/node_modules interval-timer-standalone/dist
rmdir interval-timer-standalone 2>/dev/null || rm -rf interval-timer-standalone
```

### Step 5: Add Root `.gitignore`

Create or merge root `.gitignore` (copy from `apps/all-timers/.gitignore` or create minimal):

```
node_modules
dist
*.local
.DS_Store
```

### Step 6: Add Root `package.json`

Create `interval-timers/package.json`:

```json
{
  "name": "interval-timers",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w all-timers",
    "dev:all-timers": "npm run dev -w all-timers",
    "build": "npm run build -w all-timers",
    "lint": "npm run lint -w all-timers"
  }
}
```

### Step 7: Update `apps/all-timers/package.json`

Change the `name` field:

```json
"name": "all-timers",
```

(All other fields stay the same.)

### Step 8: Ensure `docs/` is in Repo

`docs/` is already at `interval-timers/docs/`. Once `.git` is at `interval-timers/`, `docs/` is inside the repo. If it was previously untracked, add it:

```bash
git add docs/
```

### Step 9: Install Dependencies

```bash
cd interval-timers
rm -f package-lock.json   # remove parent-level empty lockfile if present
npm install
```

This will install workspace dependencies and hoist/link as needed.

### Step 10: Verification

```bash
npm run dev          # should start all-timers dev server
npm run build        # should build all-timers
npm run lint         # should lint all-timers
```

### Step 11: Git Status and Commit

```bash
git status           # review moved/added/deleted files
git add -A
git commit -m "chore: Phase 1 monorepo restructure - apps/all-timers, root workspaces"
```

---

## File Checklist (What Moves Where)

| From `interval-timer-standalone/` | To |
|-----------------------------------|-----|
| `src/` | `apps/all-timers/src/` |
| `public/` | `apps/all-timers/public/` |
| `index.html` | `apps/all-timers/` |
| `vite.config.ts` | `apps/all-timers/` |
| `tsconfig.json` | `apps/all-timers/` |
| `tsconfig.app.json` | `apps/all-timers/` |
| `tsconfig.node.json` | `apps/all-timers/` |
| `tailwind.config.js` | `apps/all-timers/` |
| `postcss.config.js` | `apps/all-timers/` |
| `eslint.config.js` | `apps/all-timers/` |
| `package.json` | `apps/all-timers/` (then update name) |
| `package-lock.json` | `apps/all-timers/` |
| `README.md` | `apps/all-timers/` |
| `.gitignore` | `apps/all-timers/` |
| `.git/` | `interval-timers/` (repo root) |
| `node_modules/` | DELETE (reinstall) |
| `dist/` | DELETE (rebuild) |

---

## Rollback (If Needed)

If something goes wrong before committing:

```bash
git reset --hard HEAD
git clean -fd
# Then manually restore structure from backup or re-clone
```

---

## Post-Phase 1: Workspace Path

After completion, the workspace root (`interval-timers/`) **is** the repo root. Open `interval-timers/` in Cursor/IDE. The `interval-timer-standalone` folder no longer exists.
