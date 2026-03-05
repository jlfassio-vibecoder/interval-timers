# Commands Reference

## From Repo Root

Run these from the monorepo root (`interval-timers/`):

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the landing app dev server (default app) |
| `npm run dev:landing` | Same as `dev` — start landing |
| `npm run build` | Build landing for production |
| `npm run build:deploy` | Build landing + all 13 standalone timer apps and merge into one output (use as Vercel Build Command) |
| `npm run preview:deploy` | Build and serve the deploy output locally (landing + all standalones) for testing standalone URLs |
| `npm run lint` | Lint landing |

### Workspace-specific

| Command | Description |
|---------|-------------|
| `npm run dev:daily-warmup` | Start the Daily Warm-up app dev server |
| `npm run build:daily-warmup` | Build the Daily Warm-up app |
| `npm run dev:tabata` | Start the Tabata app dev server |
| `npm run build:tabata` | Build the Tabata app |
| `npm run dev:japanese-walking` | Start the Japanese Walking app dev server |
| `npm run build:japanese-walking` | Build the Japanese Walking app |
| `npm run dev:aerobic` | Start the Aerobic app dev server |
| `npm run build:aerobic` | Build the Aerobic app |
| `npm run dev:amrap` | Start the AMRAP app dev server |
| `npm run build:amrap` | Build the AMRAP app |
| `npm run dev:lactate-threshold` | Start the Lactate Threshold app dev server |
| `npm run build:lactate-threshold` | Build the Lactate Threshold app |
| `npm run dev:power-intervals` | Start the Power Intervals app dev server |
| `npm run build:power-intervals` | Build the Power Intervals app |
| `npm run dev:gibala-method` | Start the Gibala Method app dev server |
| `npm run build:gibala-method` | Build the Gibala Method app |
| `npm run dev:wingate` | Start the Wingate app dev server |
| `npm run build:wingate` | Build the Wingate app |
| `npm run dev:timmons` | Start the Timmons Method app dev server |
| `npm run build:timmons` | Build the Timmons Method app |
| `npm run dev:emom` | Start the EMOM app dev server |
| `npm run build:emom` | Build the EMOM app |
| `npm run dev:ten-twenty-thirty` | Start the 10-20-30 app dev server |
| `npm run build:ten-twenty-thirty` | Build the 10-20-30 app |
| `npm run dev:bio-sync-sixty` | Start the Bio-Sync Sixty app dev server |
| `npm run build:bio-sync-sixty` | Build the Bio-Sync Sixty app |

---

## Landing and Standalone Timers

The site is a landing app at `/` plus 13 standalone timer apps, each at its own path:

- **Landing:** `npm run dev` (or `npm run dev:landing`) — serves the protocol grid at `/`. When only the landing dev server is running, visiting a standalone path (e.g. `/emom-timer`) will show the landing page; that is expected.
- **Standalone timers:** Each protocol has its own app; use `npm run dev:<app>` to run one (e.g. `npm run dev:daily-warmup`). Paths like `/daily-warm-up`, `/tabata-timer`, `/japanese-walking`, `/aerobic-timer`, `/amrap`, `/lactate-threshold`, `/power-intervals`, `/gibala-method`, `/wingate`, `/timmons`, `/emom-timer`, `/10-20-30`, `/bio-sync60` are served by the corresponding standalone app in production.
- **Testing standalone URLs locally:** To verify that links like `/emom-timer` open the correct timer (not the landing page), run the full production build and preview: `npm run preview:deploy` (or `npm run build:deploy && npm run preview -w landing`). Then open e.g. `http://localhost:4173/emom-timer`.

---

## Deployment (Vercel)

- **Build Command:** `npm run build:deploy`
- **Output Directory:** `apps/landing/dist`

`build:deploy` builds the landing app, then all 13 standalone apps (daily-warmup, tabata, japanese-walking, aerobic, amrap, lactate-threshold, power-intervals, gibala-method, wingate, timmons, emom, ten-twenty-thirty, bio-sync-sixty), and copies each app’s dist into `apps/landing/dist`. Rewrites in `vercel.json` route each path to the correct app. Legacy paths `/wingate-test` and `/timmons-protocol` redirect to `/wingate` and `/timmons`.

**If standalone URLs show the landing page in production:** Ensure `vercel.json` includes `buildCommand: "npm run build:deploy"` (it overrides Vercel's auto-detected build). The project **Root Directory** must be the repo root (not `apps/landing`), so the build command and output paths resolve correctly.
