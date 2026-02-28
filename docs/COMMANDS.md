# Commands Reference

## From Repo Root

Run these from the monorepo root (`interval-timers/`):

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the all-timers dev server (default app) |
| `npm run dev:all-timers` | Same as `dev` — start all-timers |
| `npm run build` | Build all-timers for production |
| `npm run build:deploy` | Build all-timers + amrap + lactate-threshold + power-intervals + gibala-method + wingate + timmons + emom + ten-twenty-thirty and merge into one output (use as Vercel Build Command so /amrap, /lactate-threshold, /power-intervals, /gibala-method, /wingate, /timmons, /emom-timer, /10-20-30 are served by standalone apps) |
| `npm run lint` | Lint all-timers |

### Workspace-specific

| Command | Description |
|---------|-------------|
| `npm run dev:daily-warmup` | Start the Daily Warm-up app dev server |
| `npm run build:daily-warmup` | Build the Daily Warm-up app |
| `npm run dev:power-intervals` | Start the Power Intervals (Phosphagen) app dev server |
| `npm run build:power-intervals` | Build the Power Intervals app |
| `npm run dev:wingate` | Start the Wingate app dev server |
| `npm run build:wingate` | Build the Wingate app |
| `npm run dev:timmons` | Start the Timmons Method app dev server |
| `npm run build:timmons` | Build the Timmons Method app |
| `npm run dev:emom` | Start the EMOM app dev server |
| `npm run build:emom` | Build the EMOM app |
| `npm run dev:ten-twenty-thirty` | Start the 10-20-30 app dev server |
| `npm run build:ten-twenty-thirty` | Build the 10-20-30 app |

---

## Daily Warm-up Timer

### In all-timers (current)

The Daily Warm-up is one of 12 protocols in the all-timers app. To run it:

1. Start the dev server from repo root:
   ```bash
   npm run dev
   ```
2. Open the app (e.g. http://localhost:5173) and either:
   - Click **Daily Warm-Up** on the landing page, or
   - Go directly to: `http://localhost:5173/daily-warm-up` (or `?protocol=warmup` — redirects to path)

### Standalone app

Run the daily-warmup app on its own (no protocol selector — warm-up flow only):

```bash
npm run dev:daily-warmup
```

Then open the URL shown (e.g. http://localhost:5174).

---

## Deployment (Vercel)

To serve `/amrap`, `/lactate-threshold`, `/power-intervals`, `/gibala-method`, `/wingate`, `/timmons`, `/emom-timer`, and `/10-20-30` from standalone apps (not the all-timers SPA), set in the Vercel project:

- **Build Command:** `npm run build:deploy`
- **Output Directory:** `apps/all-timers/dist` (unchanged)

`build:deploy` builds all-timers, amrap, lactate-threshold, power-intervals, gibala-method, wingate, timmons, emom, and ten-twenty-thirty, then copies each of those app dists into `apps/all-timers/dist`. Rewrites in `vercel.json` send `/amrap`, `/lactate-threshold`, `/power-intervals`, `/gibala-method`, `/wingate`, `/timmons`, `/emom-timer`, and `/10-20-30` (and their subpaths) to those folders.

Other standalone apps (aerobic, tabata, japanese-walking, daily-warmup) are not part of `build:deploy` yet. Paths like `/aerobic-timer` are redirected from `?protocol=aerobic` but are still served by the all-timers SPA until those apps are added to the deploy script and rewrites.
