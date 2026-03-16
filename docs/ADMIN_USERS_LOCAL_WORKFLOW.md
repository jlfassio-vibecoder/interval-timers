# Admin Users List — Exact Local Workflow (Why It Works)

This doc traces the **successful** flow when the admin users list works locally, so production can be matched step by step.

---

## 1. Page load (admin UI)

- **URL:** e.g. `http://localhost:3006/admin` or `http://localhost:3006/admin/users`
- **Entry:** `apps/app/src/pages/admin/[...slug].astro`
  - Server runs `verifyTrainerOrAdminRequest(request, cookies)`:
    - Reads **anon** key and URL from env (`SUPABASE_URL`, `SUPABASE_ANON_KEY` / `VITE_*` / `PUBLIC_*`).
    - Gets session from cookie `sb-access-token` (or `Authorization: Bearer …`).
    - Creates a Supabase client with the **anon** key and that token, then:
      - `auth.getUser(token)` → validates session.
      - `from('profiles').select('role').eq('id', user.id).single()` → RLS allows (user reading own row).
    - Ensures `profile.role` is `trainer` or `admin`.
  - If not authenticated/authorized → redirect to login.
  - Otherwise renders `<AdminDashboard />` (React Router).
- **React:** `AdminDashboard` mounts; route `users` renders `ManageUsers`.

**Relevant code:**  
`apps/app/src/pages/admin/[...slug].astro`,  
`apps/app/src/lib/supabase/admin/auth.ts` (`verifyTrainerOrAdminRequest`),  
`apps/app/src/components/react/admin/AdminDashboard.tsx` (route `users` → `ManageUsers`).

---

## 2. Client fetches users

- **Component:** `apps/app/src/components/react/admin/views/ManageUsers.tsx`
- **On mount:** `useEffect` → `fetchUsers()`.
- **Request:**
  - `fetch('/api/admin/users', { credentials: 'include' })`
  - Same origin as the app (e.g. `http://localhost:3006/api/admin/users`).
  - Browser sends cookies (including `sb-access-token`).

---

## 3. API: auth (who is calling)

- **Handler:** `apps/app/src/pages/api/admin/users.ts` (GET).
- **Step 1 — Verify caller is trainer/admin:**
  - `verifyTrainerOrAdminRequest(request, cookies)` (same as in step 1):
    - Uses **anon** key + URL from env.
    - Extracts token from cookie/header → `supabase.auth.getUser(token)`.
    - Queries `profiles` for **that user’s** `role` (RLS allows own row).
    - Throws if not trainer or admin.
  - So: the **request** is authenticated and authorized using the **anon** key + user’s JWT.

**Relevant code:**  
`apps/app/src/lib/supabase/admin/auth.ts` (`verifyTrainerOrAdminRequest`, `extractAccessToken`).

---

## 4. API: load all profiles (why local returns data)

- **Step 2 — Fetch all users:**
  - `getAllUsersWithAuthServer()` → `getAllUsersServer()` in  
    `apps/app/src/lib/supabase/admin/statistics.ts`.
  - `getAllUsersServer()` uses **`getSupabaseServer()`** from  
    `apps/app/src/lib/supabase/server.ts`.

- **`getSupabaseServer()` (server.ts):**
  - **Env loading:**  
    `server.ts` runs `loadEnv()` for:
    - monorepo root `.env` and `.env.local`
    - app `.env.local` (if present)
    so `process.env.SUPABASE_*` is set at runtime.
  - **Key choice:**
    - If `process.env.SUPABASE_SERVICE_ROLE_KEY` is set → use **service role** key.
    - Else → use anon key.
  - **Locally:** Your root `.env` has:
    - `SUPABASE_SERVICE_ROLE_KEY=eyJ...` (the **service_role** JWT, not anon).
  - So locally `getSupabaseServer()` returns a client created with the **service role** key.

- **Query:**
  - That client calls:
    - `supabase.from('profiles').select('id, email, full_name, ...').order('created_at', ...)`.
  - Service role **bypasses RLS**, so the query returns **all** rows in `profiles`.

- **Response:**
  - `users` = array of profiles (mapped to `UserProfile`).
  - `_hint` is only added when `users.length === 0 && !hasServiceRoleKey()`, so locally you usually get no hint.

**Relevant code:**  
`apps/app/src/lib/supabase/server.ts` (`getSupabaseServer`, `hasServiceRoleKey`, env loading),  
`apps/app/src/lib/supabase/admin/statistics.ts` (`getAllUsersServer`, `getAllUsersWithAuthServer`),  
root `.env` (`SUPABASE_SERVICE_ROLE_KEY`).

---

## 5. Client renders the list

- **ManageUsers** receives `200` and JSON `{ users: [...] }`.
  - Handles both legacy array and `{ users, _hint }`.
- `setUsers(list)` → table shows all users.

---

## Summary: what must be true for “users displaying”

| Step | What | Local (working) |
|------|------|------------------|
| 1–2 | Admin page + cookie | You’re logged in; cookie `sb-access-token` sent. |
| 3 | API auth | Anon key + URL in env; token valid; profile.role is trainer/admin. |
| 4 | Load all profiles | **Service role key** in env → `getSupabaseServer()` uses it → client bypasses RLS → all profiles returned. |
| 5 | UI | Response has `users` array → table renders. |

**The single critical difference for production:**  
`getSupabaseServer()` must have access to **`SUPABASE_SERVICE_ROLE_KEY`** (the **service_role** secret from Supabase Dashboard → Project Settings → API). If that env var is missing or set to the anon key, the server uses the anon key with no user context for that call, RLS applies, and the query returns no rows → empty list (and optionally `_hint` in the response).

---

## Production checklist (match local)

1. **Vercel (App project — interval-timers-accounts):**
   - `SUPABASE_URL` = same as local (e.g. `https://dgxoyhkqdxarewmanbrq.supabase.co`).
   - `SUPABASE_ANON_KEY` = anon key (for auth in steps 1 and 3).
   - **`SUPABASE_SERVICE_ROLE_KEY`** = the **service_role** secret from Supabase (Dashboard → Project Settings → API). **Not** the anon key.
2. **Redeploy** the App after setting or changing env vars.
3. **Main project (hiitworkouttimer.com):**  
   Ensure rewrites for `/admin` and `/_astro` (and `/admin/_astro` if used) proxy to the App so the admin page and its scripts load correctly (avoids MIME type errors).

Once the App has the real service role key and rewrites are correct, the same workflow as above runs in production and the users list should display.
