# AMRAP Schedule Loading in Production

When the Schedule tab shows "Loading..." indefinitely in production but works locally, `useScheduledSessions`’s Supabase request is either failing in a way the UI doesn’t surface or never completing.

## Data Flow

- **Hook:** `useScheduledSessions` in `apps/amrap/src/hooks/useScheduledSessions.ts`
- **Query:** `amrap_sessions` → `select(id, duration_minutes, workout_list, scheduled_start_at)` with date filters
- **Loading state:** `setLoading(false)` runs only after the Supabase promise resolves

If loading stays true, the promise is either hanging or the hook never finishes handling the result.

---

## Likely Causes (Production-Only)

### 1. CORS / Network

Production domain (e.g. `amrap.hiitworkouttimer.com`) may not be allowed in Supabase.

**Check:** Supabase Dashboard → Settings → API → “Allowed request origins” or “CORS allowed origins”. Add your production URL.

**Check:** DevTools → Network → filter by your Supabase host → verify the schedule request:
- Pending → likely CORS or blocked
- 4xx/5xx → inspect response body

### 2. Supabase URL / Anon Key in Production

Wrong or empty env at build time.

**Check:** Production build env (Vercel or hosting provider) has:
- `VITE_SUPABASE_URL` (or `SUPABASE_URL`)
- `VITE_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY` / `PUBLIC_SUPABASE_ANON_KEY`)

Vite injects these at build time. If they’re missing or incorrect, Supabase calls can fail or hang.

**Check:** In production, open the console and look for:
```
AMRAP With Friends: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env
```
(Only shown if URL or key is empty.)

### 3. Cookie Auth / `createBrowserClient`

If `VITE_AUTH_COOKIE_DOMAIN` is set, the app uses `createBrowserClient` instead of the plain client. Cookie handling can differ between localhost and production:

- Cookies scoped to the wrong domain
- Cross-subdomain auth misconfiguration
- Auth init hanging and blocking other requests

**Check:** Temporarily remove or disable `VITE_AUTH_COOKIE_DOMAIN` in production to see if the schedule loads.

### 4. Migration Order / `scheduled_start_at`

`amrap_sessions` uses column-level grants. If `scheduled_start_at` is not granted, the query fails with a permission error (which should surface in `error`, not infinite loading).

**Verify:** All migrations are applied in order:

- `20250305800000_amrap_scheduled_start.sql` – adds `scheduled_start_at` to GRANT
- `20250310000000_amrap_hud_integration.sql` – re-grants with `scheduled_start_at`
- `20250311000000_amrap_new_workout_modal.sql` – re-grants with `scheduled_start_at`

In Supabase SQL Editor:

```sql
SELECT column_name FROM information_schema.column_privileges
WHERE table_name = 'amrap_sessions'
  AND grantee = 'anon'
  AND privilege_type = 'SELECT';
```

Ensure `scheduled_start_at` is included.

---

## Quick Debug

Add temporary logging in `useScheduledSessions.ts`:

```ts
const fetchSessions = useCallback(async () => {
  setLoading(true);
  setError(null);
  console.log('[Schedule] Fetching sessions…');
  const { data, error: e } = await supabase
    .from('amrap_sessions')
    // ...
  console.log('[Schedule] Result:', { dataCount: data?.length, error: e?.message });
  setLoading(false);
  // ...
}, [weekStart.getTime(), weekEnd.getTime()]);
```

- If you see `Fetching sessions…` but never `Result:` → request is hanging (CORS, network, or auth).
- If you see `Result:` with an error → inspect `error.message`.
- If you see `Result:` with no error and `dataCount: 0` → data flow is fine; UI can handle empty state.

---

## Defensive Fix: Timeout (Implemented)

A 15-second timeout with `AbortController` was added. If the request hangs, loading clears and the user sees: "Request timed out. Check your connection and try again."

To avoid infinite “Loading…” when the request hangs, add a timeout in the hook. 
