# Commands Reference

## From Repo Root

Run these from the monorepo root (`interval-timers/`):

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the all-timers dev server (default app) |
| `npm run dev:all-timers` | Same as `dev` — start all-timers |
| `npm run build` | Build all-timers for production |
| `npm run lint` | Lint all-timers |

### Workspace-specific (future)

When additional apps exist (e.g. `daily-warmup`):

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
   - Go directly to: `http://localhost:5173?protocol=warmup`

### Standalone app (Phase 2)

When `apps/daily-warmup/` exists, run it as its own app:

```bash
npm run dev:daily-warmup
```

Then open the URL shown (e.g. http://localhost:5174). No protocol selector — it runs only the warm-up flow.
