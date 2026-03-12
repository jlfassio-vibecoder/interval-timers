# Investigation: Account link landing at /?hud=1 instead of /account

## Summary

When selecting "Account" from the AMRAP page while logged in, users land at `http://localhost:3006/?hud=1#access_token=...&refresh_token=...&type=recovery` instead of `http://localhost:3006/account`.

**Root cause:** `AccountLink` uses `VITE_ACCOUNT_REDIRECT_URL ?? VITE_HUD_REDIRECT_URL ?? '/account'` as the destination URL. If `VITE_HUD_REDIRECT_URL` is set to `http://localhost:3006/?hud=1` (and `VITE_ACCOUNT_REDIRECT_URL` is unset), that wrong URL is used.

---

## What the user is accessing

### Two ways to reach AMRAP

1. **Standalone AMRAP** (origin `http://localhost:5177`)
   - Run `npm run dev:amrap` or `npm run dev:amrap:video`
   - Open `http://localhost:5177/amrap/...`
   - AMRAP uses its own nav; "Account" / "My Account" use `AccountLink`

2. **AMRAP via hub proxy** (origin `http://localhost:3006`)
   - Run `npm run dev:amrap:video` (both AMRAP and app)
   - Open `http://localhost:3006/amrap/...` (hub proxies to 5177)
   - Same-origin as hub; no token handoff

### Token-in-URL handoff

- Only when AMRAP origin ≠ hub origin (standalone AMRAP at 5177)
- `AccountLink` adds `access_token` and `refresh_token` to the URL hash so the hub can restore the session
- So the destination URL comes directly from env: `VITE_ACCOUNT_REDIRECT_URL ?? VITE_HUD_REDIRECT_URL ?? '/account'`

### Where `/?hud=1` comes from

- Used by **StandaloneNav** for the "You" (HUD) button on programs/challenges/exercises pages
- In `StandaloneNav.tsx`: `onShowHUD` does `window.location.href = '/?hud=1'`
- It is **not** used by AccountLink or the Account page

---

## Flow when it breaks

1. User is on AMRAP at `localhost:5177` (standalone).
2. User clicks "Account" or "My Account" → `AccountLink`.
3. `AccountLink` builds the target URL from env and appends tokens to the hash.
4. If `VITE_HUD_REDIRECT_URL` is set to `http://localhost:3006/?hud=1`, the URL becomes:
   - `http://localhost:3006/?hud=1#access_token=...&refresh_token=...&type=recovery`
5. User lands on hub root with HUD open instead of the Account page.

---

## Env resolution

AMRAP `vite.config.ts` has:

```js
envDir: path.resolve(__dirname, '../..'),
```

so env is loaded from the **monorepo root**. Env can come from:

- `apps/amrap/.env`
- `apps/amrap/.env.local`
- Root `.env`
- Root `.env.local`

Order/precedence: Vite typically prefers more specific (app) over root, but both can affect the build. `VITE_ACCOUNT_REDIRECT_URL` and `VITE_HUD_REDIRECT_URL` should be set per app (or root) as needed.

---

## Fix

**Quick start:** Copy `VITE_ACCOUNT_REDIRECT_URL=http://localhost:3006/account` from `apps/amrap/.env.example` into `apps/amrap/.env` for local dev.

1. **Check env for wrong `VITE_HUD_REDIRECT_URL`**
   - Search all `.env` and `.env.local` in the repo
   - Ensure `VITE_HUD_REDIRECT_URL` is not `http://localhost:3006/?hud=1`
   - It should be `/account` or unset

2. **Ensure Account uses the right var**
   - For Account links, prefer `VITE_ACCOUNT_REDIRECT_URL`
   - For AMRAP dev, use:  
     `VITE_ACCOUNT_REDIRECT_URL=http://localhost:3006/account`  
     in `apps/amrap/.env` or `.env.local`

3. **Avoid using `VITE_HUD_REDIRECT_URL` for Account**
   - `VITE_HUD_REDIRECT_URL` is a fallback and is easy to confuse with HUD behavior
   - If needed, keep it as `/account` (or another non-`?hud=1` path), not `/?hud=1`

---

## Expected URLs

| Context              | Click    | Expected URL                               |
|----------------------|----------|--------------------------------------------|
| AMRAP (5177), logged in | Account  | `http://localhost:3006/account#access_token=...` |
| Hub (3006), logged in   | Account  | `http://localhost:3006/account`            |
| Hub (3006), logged in   | You (HUD)| HUD overlay; URL may become `/`            |
| StandaloneNav page (programs, etc.) | You (HUD) | `http://localhost:3006/?hud=1` (then cleaned) |
