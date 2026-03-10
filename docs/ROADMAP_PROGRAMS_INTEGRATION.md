# Roadmap: Programs App Integration

Integration plan for wiring the **app** into the interval-timers monorepo as a subscription landing and HUD for users. We start with the main landing and HUD, then adopt other programs features as needed.

---

## Goals

- Use **programs** as the landing/dashboard for subscription users
- **HUD** (Heads Up Display) as the primary user experience: today’s workouts, schedule, history
- Keep the existing **main landing** (`apps/landing`) for free users and protocol discovery
- Integrate further programs features (admin, trainer, catalog) over time

---

## Current State

### Monorepo

- **Landing** (`apps/landing`): Astro, protocol grid at `/`
- **Standalone timers** (13 apps): Vite apps built and copied into `apps/landing/dist`
- **Build**: `build:deploy` builds landing + all standalones, copies to `apps/landing/dist`
- **Deploy**: Vercel from `apps/landing/dist` with `vercel.json` rewrites
- **App** (`apps/app`): Astro SSR app, port 3006, has its own Supabase migrations

### Programs App Structure

- **HUD**: `HUDShell`, `HUDContent` → TodayZone, ProgressZone, ScheduleZone, HistoryZone
- **Entry**: `?hud=1` or “HUD” nav button opens overlay on homepage
- **Pages**: `/`, `/programs`, `/workouts`, `/exercises`, `/challenges`, `/trainer`, `/admin/*`, etc.
- **Dependencies**: `@workout-generator/design-system`, Supabase, Firebase refs in PWA config

---

## Phase 1: Foundation (Monorepo Wiring)

### 1.1 Dependency Resolution

- [ ] **Design-system**: `@workout-generator/design-system` is not in this monorepo
  - Option A: Add `packages/design-system` (or equivalent) if source exists
  - Option B: Replace with `@interval-timers/timer-ui` + Tailwind where feasible
  - Option C: Publish / vend design-system into monorepo and add to `package.json` workspaces

### 1.2 Root Scripts

- [ ] Add `dev:app` and `build:app` to root `package.json`
- [ ] Run `npm install` to ensure workspace resolution

### 1.3 Programs Build Verification

- [ ] Resolve design-system and any other missing deps
- [ ] `npm run build:app` succeeds
- [ ] App can run standalone: `npm run dev:app` → `http://localhost:3006`

---

## Phase 2: HUD as Subscription Entry Point

### 2.1 Route Strategy

Two approaches (choose one):

- **A. Programs as `/programs`**: Deploy programs at `/programs`, HUD at `/programs?hud=1`
- **B. HUD as `/hud`**: Extract HUD into `apps/hud`, link programs features via API or embed

**Recommendation**: Start with **A** — keep HUD inside programs. Simpler, reuses existing flows.

### 2.2 Main Landing → Programs Link

- [ ] Add subscription CTA on main landing (e.g. “Upgrade” / “My Workouts”) linking to `/programs` (or `/programs?hud=1`)
- [ ] Ensure link works in dev and production

### 2.3 Programs Home as Subscription Landing

- [ ] Treat programs `index.astro` as the subscription landing
- [ ] Unauthenticated: show marketing + sign-in
- [ ] Authenticated: show HUD (or redirect to HUD route)

---

## Phase 3: Deployment Integration

### 3.1 Deployment Model

Programs is Astro with `output: 'server'` (SSR). Current deploy is static (`apps/landing/dist`).

- **Option A — Same Vercel project**: Add programs as a second app in the monorepo
  - Use Vercel’s [monorepo support](https://vercel.com/docs/monorepos): set `Root Directory` to `apps/app` for a second project, or use a single project with multiple frameworks if supported
- **Option B — Separate Vercel project**: Deploy programs to its own project (e.g. `app.interval-timers.com` or `programs.interval-timers.com`)
- **Option C — Merge build output**: If programs can be built to static, copy into `apps/landing/dist/programs/` and add rewrites (programs has SSR, so this may not apply)

**Recommendation**: **Option B** initially — separate project for programs. Simpler, clear separation. Add CNAME or subdomain. Update main landing CTA to point to programs URL.

### 3.2 Build & Copy (if merging into single deploy)

If consolidating into one Vercel project:

- [ ] Add programs build to `build:deploy` (or a new `build:deploy-with-programs` script)
- [ ] Extend `scripts/copy-standalone-apps-to-dist.cjs` to copy programs output (structure depends on Astro output mode)
- [ ] Add `vercel.json` rewrites for `/programs` and `/programs/(.*)`

### 3.3 Env & Supabase

- [ ] Use monorepo root `.env` for shared Supabase (or app-specific `.env` in `apps/app`)
- [ ] App migrations live in `apps/app/supabase/` — decide:
  - Merge into root `supabase/migrations/` with prefixed names, or
  - Keep separate and document which project/schema they target

---

## Phase 4: HUD Feature Parity & UX

### 4.1 HUD Features (from programs)

| Component     | Purpose                    | Priority |
|---------------|----------------------------|----------|
| TodayZone     | Today’s workouts           | P0       |
| ProgressZone  | Recent progress, stats     | P0       |
| ScheduleZone  | Calendar, schedule         | P1       |
| HistoryZone   | Workout history            | P1       |
| QuickStatsBar | Quick stats                | P2       |
| ReadinessCheckIn | Pre-workout check-in   | P2       |

### 4.2 Link to Interval Timers

- [ ] From HUD, link to existing timer apps (e.g. `/amrap`, `/tabata-timer`) for workout execution
- [ ] Consider “Add to HUD” or “Schedule” from timer landing pages back to programs/HUD

---

## Phase 5: Future Integrations (As Needed)

Adopt programs features incrementally:

| Feature        | Location in programs           | Use case                          |
|----------------|--------------------------------|-----------------------------------|
| Program catalog| `ProgramCatalog`, `programs/`  | Browse and assign programs        |
| Workouts       | `workouts/`, WOD engine        | Custom workouts                   |
| Trainer view   | `trainer/`, client stats       | Trainers managing clients         |
| Admin          | `admin/`, workouts, exercises  | Content and workout management    |
| Exercises      | `exercises/`                   | Exercise library                  |
| Challenges     | `challenges/`                  | Challenge programs                |

---

## Checklist Summary

- [ ] Resolve `@workout-generator/design-system`
- [ ] Add `dev:app`, `build:app` to root
- [ ] Verify app builds and runs
- [ ] Add subscription CTA on main landing → programs
- [ ] Choose deployment model (separate project vs merged)
- [ ] Configure deployment and env
- [ ] Document Supabase migration strategy
- [ ] Add HUD ↔ timer app links

---

## References

- `apps/app/docs/architecture/directory-structure.md`
- `apps/app/src/components/react/hud/` (HUD components)
- `scripts/copy-standalone-apps-to-dist.cjs` (copy pattern for static apps)
- `vercel.json` (current rewrites)
- `docs/COMMANDS.md` (monorepo commands)
