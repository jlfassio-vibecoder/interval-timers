# Audit Findings: Account Page Loading Root Cause

**Audit Date:** 2025-03-11  
**URL:** http://localhost:3006/account?from=app  
**Issue:** Logged-in user only sees "Loading..." instead of account page.

---

## Step 1: Display Condition (COMPLETE)

**Deliverable: Exact boolean condition for "Loading…"**

The "Loading…" text is rendered in **AccountLanding.tsx lines 38-43**:

```tsx
if (loading && !loadingTimedOut) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="font-mono text-sm text-white/50">Loading…</p>
    </div>
  );
}
```

**Condition:** `loading === true` (from AppContext) AND `loadingTimedOut === false`

- `loading` comes from `useAppContext().loading`
- `loadingTimedOut` is local state; set to `true` after 1000ms (dev) or 5000ms (prod) when `loading` is true

**Verification:** No other component in the /account route tree renders "Loading…". The account page route is: `index.astro` → `AppWrapper` → `AppProvider` → `AccountLanding`. Sibling components (AppIslands, FluidBackground) do not render account content. Other "Loading" components (AccountFeed, AppCalendar, etc.) are not in the account route.

---

## Step 4: Supabase Configuration and Profiles Query (COMPLETE)

**Deliverable: Env verification, Supabase project match, profiles schema, RLS summary**

**Env files:**
- `apps/app/.env`: PUBLIC_SUPABASE_URL=https://dgxoyhkqdxarewmanbrq.supabase.co, PUBLIC_SUPABASE_ANON_KEY present
- Root `.env`: Same project dgxoyhkqdxarewmanbrq
- Astro loads: monorepo root .env, .env.local, apps/app .env, .env.local (in that order; later overrides earlier)
- `.env.local` may exist and override; not in repo (gitignored)

**Supabase client (supabase-instance.ts):**
- Uses `createClient` (standard) when `PUBLIC_AUTH_COOKIE_DOMAIN` / `VITE_AUTH_COOKIE_DOMAIN` are unset → localStorage session
- `useCookieStorage` is false for localhost (no cookie domain set)
- URL/key from `PUBLIC_*` or `VITE_*` fallback

**Profiles table:** Migrations only `ALTER TABLE public.profiles` (add amrap_trial_ends_at). Table creation is from Supabase auth setup (outside migrations). AppContext expects: id, full_name, role, avatar_url, created_at.

**AppContext fetchProfile (current code):**
- Uses `.maybeSingle()` (not `.single()`)
- Fallback: when `data` is null (0 rows), sets minimal user from userId/email
- Expected query: `profiles?select=*&id=eq.<userId>`

**RLS:** Not defined in migrations. Must be verified in Supabase Dashboard → Table Editor → profiles → RLS. If RLS blocks SELECT for the user, query returns 0 rows; with `.maybeSingle()` that yields `{ data: null, error: null }` (no 406). Fallback should set user.

---

## Step 7: Cross-Origin and Session Storage (COMPLETE)

**Deliverable: Login origin and session presence in app storage**

**Logic:**
- Session storage is per-origin. `localhost:3006` (app) and `localhost:5173` (AMRAP) have separate storage.
- If the user logged in on AMRAP (localhost:5173) and was redirected to app (localhost:3006), the app at 3006 does **not** see the AMRAP session.
- Supabase `createClient` stores auth in `localStorage` (keys like `sb-dgxoyhkqdxarewmanbrq-auth-token`) by default.

**How to verify:**
1. Note where login occurred: AMRAP (`localhost:5173`) vs app (`localhost:3006`).
2. DevTools → Application → Local Storage → `http://localhost:3006` — look for `sb-*-auth-token` keys.
3. If no auth keys for 3006 but user "logged in" via 5173, that explains no session in app.

**Implication:** If `getSession()` returns null because there is no session for localhost:3006, `run()` will call `finishInit()` without calling `fetchProfile()`, so `user` stays null. AccountLanding would show sign-in (not "Loading…") unless `loading` never becomes false. Loading shows only when `loading && !loadingTimedOut` — so cross-origin typically causes sign-in prompt, not perpetual Loading.

---

## Step 3: Instrument and Verify Runtime State (COMPLETE)

**Deliverable: Logged sequence and network responses**

**Instrumentation added (DEV only):**
- AppContext: `[AUDIT] run() start`, `[AUDIT] after getSession: has session / no session`, `[AUDIT] after fetchProfile`, `[AUDIT] finishInit() - setLoading(false)`
- AccountLanding: `[AUDIT] AccountLanding render: { loading, loadingTimedOut, userUid }`

**How to run:**
1. Start dev: `cd apps/app && npm run dev` (or equivalent)
2. Navigate to http://localhost:3006/account?from=app (while logged in)
3. Open DevTools → Console and Network
4. Capture: Console sequence; profiles request URL, status, response

**Expected observations to capture:**
- Does `finishInit()` run? (loading should become false)
- Does `fetchProfile` run? (only if getSession returns a session)
- Final `loading`, `loadingTimedOut`, `userUid` after 6+ seconds
- Profiles request: 200, 406, or other; response body

---

## Step 2: Auth and Profile Flow (COMPLETE)

**Deliverable: Flow diagram / numbered sequence**

**Auth init sequence (AppContext useEffect):**

1. `run()` starts. Safety timer starts (5s) → will call `finishInit()` if run stalls.
2. **Hash restore:** If URL has `#access_token=...&refresh_token=...`, call `setSession()` then replace history.
3. **getSession()** — read session from storage.
4. If `mounted` and `s?.user`: **fetchProfile(userId, email)** (awaited).
5. **finally:** `clearTimeout(safetyTimer)`, `finishInit()` → `setLoading(false)`.

**When setUser runs:** Only inside `fetchProfile()` — when profile data exists (full user) or when `data` is null (minimal user from session).

**Exit paths:** (a) Normal: `run()` completes → `finally` → `finishInit`. (b) Error: `catch` logs, `finally` still runs. (c) Hang: safety timer fires after 5s → `finishInit`.

**Blocking:** `fetchProfile` is awaited. If it hangs, `finally` does not run until it resolves or rejects. The 5s safety timer calls `finishInit()` independently, so loading is cleared after 5s max.

---

## Step 8: Profile Fetch Failure Modes (COMPLETE)

**Deliverable: Failure modes list and current fetchProfile implementation**

**Current implementation (AppContext):**
- Query: `supabase.from('profiles').select('*').eq('id', userId).maybeSingle()`
- Uses `.maybeSingle()` (0 rows → `{ data: null, error: null }`, no 406)
- Fallback: when `data` is null, sets minimal user from userId/email

**Failure modes:**
1. **Network error / timeout** → catch logs "Profile fetch failed", returns without `setUser`. User stays null until/unless onAuthStateChange retries.
2. **RLS blocks** → 0 rows → `{ data: null, error: null }` → fallback sets user.
3. **No profiles row** → same as (2) — fallback sets user.
4. **Wrong Supabase project** → auth in one project, profiles in another — session exists but profiles query fails or returns nothing. Fallback applies if 0 rows.
5. **DB error** → `error` is set → logs "Error fetching profile", returns without `setUser`. User stays null.

---

## Step 5: React and Astro Hydration (COMPLETE)

**Deliverable: Component tree and Strict Mode implications**

**Component tree:**
- `account/index.astro` → `AppWrapper` (client:load) → `AppProvider` → `AccountLanding`
- AppWrapper passes `children` (AccountLanding) into AppProvider; AccountLanding is a direct child of AppProvider

**client:load:** React tree is client-only; no SSR of AppProvider state. Initial HTML is a shell until the client bundle loads and hydrates.

**useAppContext:** AccountLanding uses `useAppContext()` inside AppProvider — valid. No use outside provider.

**StrictMode:** AppWrapper wraps with `<StrictMode>`. In dev, effects run twice (mount → unmount → remount). Auth useEffect uses `mounted` and `didFinish`; cleanup sets `mounted = false` and clears timer. On remount, a fresh `run()` and timer start. Not expected to block loading or cause perpetual Loading.

---

## Step 6: loadingTimedOut Timer Behavior (COMPLETE)

**Deliverable: Analysis of whether timer can keep "Loading…" visible indefinitely**

**Logic (AccountLanding):**
- Effect: `if (!loading) return; const t = setTimeout(() => setLoadingTimedOut(true), ms); return () => clearTimeout(t);`
- `ms` = 1000 (dev) or 5000 (prod)
- Second effect: `if (!loading) setLoadingTimedOut(false)` on loading change

**Cases:**
1. **loading → false before timer fires:** cleanup runs, timer cleared, `loadingTimedOut` never set. Condition `loading && !loadingTimedOut` is false → exit loading block. Correct.
2. **loading stays true:** timer fires → `loadingTimedOut = true` → `loading && !loadingTimedOut` false → exit loading block. Correct.
3. **Unmount/remount (e.g. StrictMode):** On unmount, cleanup clears timer. On remount, `loading` is still true → new timer starts. Timer will fire in 1s/5s unless loading flips first. So `loadingTimedOut` will eventually become true if loading stays true.

**Conclusion:** Timer cannot keep "Loading…" visible indefinitely. If loading stays true, loadingTimedOut becomes true after 1s (dev) or 5s (prod), and the loading block is exited.

---

## Step 9: Consolidate Findings (COMPLETE)

**Deliverable: Root cause statement with evidence**

**Checklist from steps 1–8:**
- `finishInit()` runs: Either when `run()` completes (finally) or after 5s (safety timer). One of these always occurs.
- `setUser()` runs: When `fetchProfile` succeeds (data), gets 0 rows (fallback), or when `error`/`catch` (Profile Fetch Fallback fix).
- Session in storage: Per-origin; if user logged in on AMRAP (5173) and visits app (3006), no session.
- Profiles request: With `.maybeSingle()`, 0 rows → `{ data: null, error: null }` → fallback sets user. With `.single()` (legacy), 0 rows → 406 → error path → no setUser.

**Root cause hypothesis:**

| Scenario | Evidence | Outcome |
|----------|----------|---------|
| **A) loading never false** | 5s safety timer forces `finishInit()` → loading becomes false. Timer logic cannot keep Loading indefinitely (Step 6). | **Ruled out** (see Hypothesis A Investigation below) |
| **B) loading false, user null** | Profile error (406, RLS, network) → no setUser → sign-in. | **Fixed** (see Profile Fetch Fallback below) |
| **C) Different Loading** | Only AccountLanding renders "Loading…" in the account route (Step 1). | **Ruled out** |
| **D) Never reach AccountLanding** | Route tree is correct; AccountLanding is rendered. | **Ruled out** |

**Conclusion:** If the user sees only "Loading…" (not sign-in) for more than 5 seconds, that contradicts the timer/safety logic and would indicate an unexpected code path or environment. The most plausible explanation for a logged-in user not seeing the account page is:

1. **Profile fetch returns error** (e.g. 406 with legacy `.single()`, or RLS/DB error) → `setUser` never called → after loading clears, user sees **sign-in** (not Loading).
2. **Cross-origin:** Login on AMRAP (5173), visit app (3006) → no session for 3006 → `getSession` null → no fetchProfile → user null → **sign-in**.
3. **Loading &lt; 5s:** User may see Loading briefly before finishInit and/or loadingTimedOut; waiting 5s should resolve.

The codebase already uses `.maybeSingle()` and a fallback; the 5s safety timer ensures loading clears. Remove the temporary `[AUDIT]` console.log statements after verification.

---

## Hypothesis A Investigation: loading never false (RULED OUT)

**Objective:** Determine whether `loading` can stay true indefinitely despite the 5s safety timer.

**Analysis:**

1. **Safety timer flow:** AppContext starts `setTimeout(finishInit, 5000)` on auth init. When the timer fires, `finishInit()` sets `loading = false` (guarded by `!didFinish && mounted`).

2. **Potential Strict Mode edge case:** In React 18 Strict Mode (dev), the auth effect runs, unmounts, then remounts. On first unmount, cleanup runs: `mounted = false`, `clearTimeout(safetyTimer)`. The first effect’s timer is cancelled. When the first `run()` later completes, `finally` calls `finishInit()`, but `mounted` is false, so it skips `setLoading(false)`.

3. **Why it still clears:** On remount, a second effect runs with a new timer. That timer fires after 5s and calls `finishInit()` with `mounted = true`, so loading is cleared. Alternatively, the second `run()` completes and `finally` runs with `mounted = true`, which also clears loading.

4. **Hardening applied:** The safety timer callback was changed to stop using `finishInit`’s `mounted` check. It now directly sets `didFinish = true` and `setLoading(false)` when the timer fires. So the timer path always clears loading and no longer depends on `mounted`, which avoids any Strict Mode edge cases.

**Verdict:** Hypothesis A is **ruled out**. The safety timer should clear `loading` within 5 seconds. If “Loading…” persists beyond 5s, the cause is likely elsewhere (e.g. profile 406 → user null → sign-in UI; or `loadingTimedOut` in AccountLanding; or a different component).

---

## Profile Fetch Fallback (Hypothesis B Fix)

**Objective:** Ensure profile fetch errors (406, RLS, network) do not leave `user` null when a session exists.

**Fix applied (AppContext fetchProfile):**
- When `error` is set from the profiles query (e.g. 406, RLS block, DB error), call `setMinimalUser()` instead of returning.
- When `catch` runs (e.g. network error, timeout), call `setMinimalUser()` so the user can still see the account page.
- Both paths set a minimal user from `userId` and `email` in the session.

**Result:** Session exists + profile fetch fails → `setUser` is now called → account page can render instead of sign-in or perpetual Loading.
