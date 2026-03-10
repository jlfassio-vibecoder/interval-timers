# Interval Timers Migration Guide

Migrate your React app (landing pages + interval timer components) into this Astro project.

---

## Decision: React vs Astro

**Keep all timer and landing components as React.** This project uses Astro for pages/layouts and React as _islands_ (`client:load` / `client:visible`). Converting your components to Astro would lose interactivity and duplicate patterns. We will:

- **React:** All 11 components (TabataInterval, MindfulWalking, AerobicPower, LactateThreshold, PhosphagenPower, GibalaMethod, WingateProtocol, TimmonsMethod, EmomTimer, AmrapTimer, TenTwentyThirty) stay as React.
- **Astro:** Used for routes, layout, and wrapping those React components (same pattern as `TabataIndexContent`, `DynamicHIITInterval`, etc.).

---

## Step 1: Copy React Components Into the Repo

1. **Create the target directory** (if it doesn’t exist):

   ```text
   src/components/react/interval-timers/
   ```

2. **Copy your component files** from your React app into that folder. Preserve your folder structure if you have subfolders (e.g. `components/TabataInterval.tsx` → `src/components/react/interval-timers/TabataInterval.tsx`).

   Suggested mapping:

   | Your React app                    | Copy to (this repo)                                         |
   | --------------------------------- | ----------------------------------------------------------- |
   | `components/TabataInterval.tsx`   | `src/components/react/interval-timers/TabataInterval.tsx`   |
   | `components/MindfulWalking.tsx`   | `src/components/react/interval-timers/MindfulWalking.tsx`   |
   | `components/AerobicPower.tsx`     | `src/components/react/interval-timers/AerobicPower.tsx`     |
   | `components/LactateThreshold.tsx` | `src/components/react/interval-timers/LactateThreshold.tsx` |
   | `components/PhosphagenPower.tsx`  | `src/components/react/interval-timers/PhosphagenPower.tsx`  |
   | `components/GibalaMethod.tsx`     | `src/components/react/interval-timers/GibalaMethod.tsx`     |
   | `components/WingateProtocol.tsx`  | `src/components/react/interval-timers/WingateProtocol.tsx`  |
   | `components/TimmonsMethod.tsx`    | `src/components/react/interval-timers/TimmonsMethod.tsx`    |
   | `components/EmomTimer.tsx`        | `src/components/react/interval-timers/EmomTimer.tsx`        |
   | `components/AmrapTimer.tsx`       | `src/components/react/interval-timers/AmrapTimer.tsx`       |
   | `components/TenTwentyThirty.tsx`  | `src/components/react/interval-timers/TenTwentyThirty.tsx`  |

3. **Copy any shared UI or assets** your components use (e.g. a shared `Button`, `Card`, or images) into this repo:
   - Shared React components → `src/components/react/interval-timers/` (or `src/components/react/` if shared with the rest of the app).
   - Images → `public/` or `src/assets/` and update imports (Astro often uses `import img from '@/assets/...'` or paths under `/` for `public/`).

---

## Step 2: Fix Imports Inside the Copied Components

1. **Path aliases:** This repo uses `@/` for `src/`. Update your imports, for example:
   - `import x from '../utils/foo'` → `import x from '@/lib/foo'` (if you move utils into `src/lib/`) or use relative paths within `interval-timers/`.
   - `import y from '../../components/Button'` → `import y from './Button'` or `@/components/react/...` as appropriate.

2. **Prop type for navigation:** Your components use `onNavigate`. Keep that interface. For Astro we will either:
   - Pass a function that uses the router (see Step 4), or
   - Use Astro file-based routes and pass a `basePath` so links point to `/interval-timers/tabata`, etc.

3. **No default React app entry:** Remove or don’t copy `index.tsx` / `main.tsx` that mounts `<App />`. We’ll mount the shell (or individual pages) from Astro.

---

## Step 3: Add a React “Shell” (Optional but Recommended)

Your current app is one React tree with `useState(currentPage)`. Two ways to integrate:

**Option A — Single shell (minimal change):**  
Keep one React component that holds the same state and renders the 11 screens.

1. Add a new component, e.g. `src/components/react/interval-timers/IntervalTimersApp.tsx`, that contains the same logic as your current `App.tsx` (state + `handleNavigate` + conditional render of TabataInterval, MindfulWalking, etc.).
2. Export it and use it from one Astro page (Step 4). Navigation stays in React (no full page reloads).

**Option B — One Astro page per protocol:**  
Use Astro’s file-based routing; each timer is its own URL.

1. No shell component. Each of the 11 components is mounted from its own Astro page.
2. Create pages like `src/pages/interval-timers/tabata.astro`, `src/pages/interval-timers/emom.astro`, etc., each importing and rendering the matching React component with `client:load`.
3. Navigation becomes links between these Astro pages (e.g. `<a href="/interval-timers/emom">EMOM</a>`). Your `onNavigate` can be replaced by passing a `basePath` (e.g. `/interval-timers`) and using `<a href={basePath + '/emom'}>` or the router.

Recommendation: **Option A** first (copy your `App` into `IntervalTimersApp.tsx` and mount it once), then we can later add Option B if you want separate URLs per protocol.

---

## Step 4: Add Astro Page(s)

1. **Create the route directory:**

   ```text
   src/pages/interval-timers/
   ```

2. **Option A (single shell):**  
   Create `src/pages/interval-timers/index.astro`:

   ```astro
   ---
   import BaseLayout from '../../layouts/BaseLayout.astro';
   import AppWrapper from '../../components/react/AppWrapper';
   import IntervalTimersApp from '../../components/react/interval-timers/IntervalTimersApp';
   ---

   <BaseLayout title="Interval Timers | AI Fitcopilot">
     <div class="min-h-screen text-white">
       <AppWrapper client:load pathname={Astro.url.pathname} />
       <main>
         <IntervalTimersApp client:load />
       </main>
     </div>
   </BaseLayout>
   ```

   So: **one URL** `/interval-timers` that loads your full React app (all 11 screens + in-app navigation).

3. **Option B (one page per protocol):**  
   Create e.g. `src/pages/interval-timers/tabata.astro` and repeat for each protocol, each importing the corresponding React component and using `client:load`. Add an index page that links to all of them.

4. **Nav:** Add “Interval Timers” to the site nav (e.g. in `Navigation.tsx` or your header component) linking to `/interval-timers` (or to the index of the interval-timers section).

---

## Step 5: Align Styling and Layout

- This repo uses **Tailwind**. If your React app uses Tailwind, class names can stay; if it uses another CSS approach, we’ll need to either add global styles or convert to Tailwind.
- **Layout:** Existing pages use `BaseLayout`, dark theme, and classes like `text-white`, `bg-black/20`. Reuse the same wrapper (as in the snippet above) so the interval timers section matches the rest of the site.
- **AppWrapper:** Include it so the main site nav and any global UI (modals, auth) work on the interval-timers pages.

---

## Step 6: Verify Build and Types

1. Run:
   ```bash
   npm run type-check
   npm run lint
   npm run build
   ```
2. Fix any import or type errors (e.g. missing types for `onNavigate`, or `window` usage that needs a guard for SSR).
3. If a component uses browser-only APIs (e.g. `window`, `document`), it’s fine as long as it’s only rendered on the client (which `client:load` ensures). Avoid using Node-only modules (`fs`, `path`) in these React components.

---

## Summary Checklist

- [ ] Create `src/components/react/interval-timers/`.
- [ ] Copy all 11 timer/landing components (and any shared components/assets) into that folder.
- [ ] Fix imports (relative paths or `@/`).
- [ ] Add `IntervalTimersApp.tsx` (copy of your current App logic) **or** plan separate Astro pages per protocol.
- [ ] Create `src/pages/interval-timers/index.astro` and mount the shell (or one React component per page).
- [ ] Add “Interval Timers” to the main nav pointing to `/interval-timers`.
- [ ] Align Tailwind/layout with existing pages.
- [ ] Run type-check, lint, build and fix issues.

After you copy the files and add the shell (or pages), we can wire up exact imports and nav links and fix any remaining type/lint errors.
