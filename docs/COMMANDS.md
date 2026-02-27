# Commands Reference

## From Repo Root

Run these from the monorepo root (`interval-timers/`):

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the all-timers dev server (default app) |
| `npm run dev:all-timers` | Same as `dev` — start all-timers |
| `npm run build` | Build all-timers for production |
| `npm run build:deploy` | Build all-timers + amrap + lactate-threshold and merge into one output (use as Vercel Build Command so /amrap and /lactate-threshold are served by standalone apps) |
| `npm run lint` | Lint all-timers |

### Workspace-specific

| Command | Description |
|---------|-------------|
| `npm run dev:daily-warmup` | Start the Daily Warm-up app dev server |
| `npm run build:daily-warmup` | Build the Daily Warm-up app |

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

To serve `/amrap` and `/lactate-threshold` from standalone apps (not the all-timers SPA), set in the Vercel project:

- **Build Command:** `npm run build:deploy`
- **Output Directory:** `apps/all-timers/dist` (unchanged)

`build:deploy` builds all-timers, amrap, and lactate-threshold, then copies each app's dist into `apps/all-timers/dist` (e.g. `amrap`, `lactate-threshold`). Rewrites in `vercel.json` send `/amrap`, `/amrap/*`, `/lactate-threshold`, and `/lactate-threshold/*` to those folders.
