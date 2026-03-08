# Admin React Architecture & Functionality Audit

**Date:** February 26, 2025  
**Scope:** The “react/admin” surface: React admin UI, how it is mounted, and how it integrates with pages, API routes, and data layers.

---

## 1. Where “react/admin” Lives

There is **no standalone `react/admin` directory**. Admin functionality is spread across:

| Area                    | Path                                                 | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **React admin UI**      | `src/components/react/admin/`                        | All React components for the admin SPA                                             |
| **Admin pages**         | `src/pages/admin/`                                   | Astro pages that mount the React app (catch-all and login)                         |
| **Admin API routes**    | `src/pages/api/admin/`                               | Astro API handlers (stats, users, programs, workouts, challenges, exercises, etc.) |
| **Admin config / nav**  | `src/lib/admin/`                                     | `config.ts` (base path), `navigation.ts` (sidebar items, active state)             |
| **Backend admin logic** | `src/lib/supabase/admin/`, `src/lib/firebase/admin/` | Server-side data and auth used by API routes and sometimes by client               |

The “react/admin” experience is **one React SPA** (router basename `/admin`) mounted from Astro, plus login flow and API calls.

---

## 2. High-Level Architecture

### 2.1 Entry and auth flow

- **Login:** `src/pages/admin/login.astro`
  - Server: `verifyAdminRequest()` (Supabase). If already admin → redirect to `/admin`.
  - Client: `AdminLoginGate` (Supabase auth, `profiles.role === 'admin'`). On success: `setAuthCookie(session)` and `window.location.href = adminPaths.root`.
- **Dashboard:** `src/pages/admin/[...slug].astro`
  - Server: `verifyAdminRequest()` again. If not admin → redirect to `/?admin_required=1` or login.
  - Client: Renders `<AdminDashboard client:only="react" />` (full React SPA).

So: **Astro does server-side admin gate**; **React runs only after the page loads** (client-only).

### 2.2 React SPA structure

- **Router:** `react-router-dom` with `basename={adminPaths.root}` (default `/admin`).
- **Layout:** `AdminLayout` in `AdminDashboard.tsx`:
  - Sidebar: `ADMIN_NAV_ITEMS` from `@/lib/admin/navigation` (Dashboard, Users, Program Factory, Challenge Factory, Workout Factory, WOD Engine, Warm-Up Engine, Exercises, Exercise Visualization Lab, Zones).
  - “Return to Home” and “Sign out” (clears auth cookie, Supabase signOut, redirect to login).
- **Context:** Entire SPA wrapped in `AppProvider` (e.g. for `user` / `useAppContext()`).
- **Routes:** All defined in `AdminDashboard.tsx`; each route renders one view component (see Section 4).

### 2.3 Base path and navigation

- **Config** (`src/lib/admin/config.ts`): `ADMIN_BASE_PATH` from `PUBLIC_ADMIN_BASE_PATH` (default `/admin`). `adminPaths.root`, `adminPaths.login`, `adminPaths.home`.
- **Navigation** (`src/lib/admin/navigation.ts`): Single source of truth for sidebar: path, label, Lucide icon. `isAdminNavActive(path, pathname)` for highlighting.

---

## 3. Data Layer (Hybrid Supabase + Firebase)

The admin UI and APIs use **both Supabase and Firebase**:

| Domain                              | Primary backend | Notes                                                                                                                                 |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**                            | Supabase        | Login, `verifyAdminRequest`, cookie, `profiles.role`                                                                                  |
| **Programs**                        | Supabase        | `src/lib/supabase/admin/programs.ts` – list, create, fetch, update; ProgramEditor, ProgramLibraryTable, ScheduleBuilder               |
| **Workouts**                        | Supabase        | `src/lib/supabase/admin/workouts.ts`, `workout-details.ts` – list, create, fetch, update blocks; WorkoutEditor, WorkoutLibraryTable   |
| **Exercises (library / generated)** | Supabase        | `exercises`, `generated-exercises`, `exercise-gallery`, etc. – ManageExercises, AdminExerciseDetailWrapper                            |
| **Zones / equipment**               | Supabase        | `src/lib/supabase/client/equipment` – ManageZones, WODEngine, etc.                                                                    |
| **Warm-up config**                  | Supabase        | `warmup-config` – WarmUpEngine                                                                                                        |
| **Challenges**                      | Firebase        | `src/lib/firebase/admin/challenge-persistence.ts` – ManageChallenges, ChallengeEditor, ChallengeLibraryTable, ChallengeGeneratorModal |
| **WODs (generated)**                | Firebase        | `src/lib/firebase/client/generated-wods` – WODEngine, WODEditor                                                                       |
| **Dashboard stats**                 | Firebase        | `src/lib/firebase/admin/statistics.ts` – `/api/admin/stats` → `getDashboardStats()`                                                   |
| **Program generator (modal)**       | Firebase        | `ProgramGeneratorModal` uses Firebase equipment + `program-persistence`                                                               |

So: **programs, workouts, exercises, zones, warm-up** are Supabase; **challenges, WODs, dashboard stats, and one program-generator path** still use Firebase. Auth is Supabase-only.

---

## 4. Functionality by Route / View

| Route                 | View                         | Main functionality                                                                                                                                                                        |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | `DashboardHome`              | Fetches `/api/admin/stats` (Firebase). Shows total users, active programs, workouts logged, growth rate, recent activity.                                                                 |
| `/users`              | `ManageUsers`                | Fetches `/api/admin/users`, search/filter, revoke via `/api/admin/users/[uid]/revoke`.                                                                                                    |
| `/programs`           | `ManagePrograms`             | List via `ProgramLibraryTable` (Supabase `fetchPrograms`), “New Program” → `createProgram` then redirect to editor.                                                                       |
| `/programs/:id`       | `ProgramEditor`              | Load/update via Supabase `programs`; form (title, description, difficulty, duration); `ScheduleBuilder` (weeks × days, add/edit/delete workouts).                                         |
| `/challenges`         | `ManageChallenges`           | `ChallengeLibraryTable` (Firebase); “Create Challenge” opens `ChallengeGeneratorModal`.                                                                                                   |
| `/challenges/:id`     | `ChallengeEditor`            | Firebase challenge persistence; blueprint, sections, images.                                                                                                                              |
| `/workouts`           | `ManageWorkouts`             | `WorkoutLibraryTable` (Firebase list), links to workout editor.                                                                                                                           |
| `/workouts/:id`       | `WorkoutEditor`              | Supabase `workout-details`: title, description, duration, difficulty, blocks (warmup/main/cooldown) with exercises; `ExerciseBlockEditor`-style editing.                                  |
| `/wod`                | `WODEngine`                  | Level/filters; generate WOD (Firebase); save/publish; swap/preview exercises; Visualization Lab modal.                                                                                    |
| `/wod/:id`            | `WODEditor`                  | Edit existing generated WOD.                                                                                                                                                              |
| `/warmup`             | `WarmUpEngine`               | Supabase warmup config (slots, exercises).                                                                                                                                                |
| `/exercises`          | `ManageExercises`            | Tabs: Library (manual + generated), Manual add, Generated; create/delete, publish generated → library; uses Supabase exercises + generated-exercises.                                     |
| `/exercises/:slug`    | `AdminExerciseDetailWrapper` | Full exercise detail (Supabase + Firebase storage for images); status, slug, deep dive, biomechanics, images/videos, modals (regenerate, common mistakes, biomechanics, add image/video). |
| `/exercise-image-gen` | `ExerciseImageGenView`       | Wraps shared `ExerciseImageGenerator` (Visualization Lab).                                                                                                                                |
| `/zones`              | `ManageZones`                | Supabase equipment/zones CRUD.                                                                                                                                                            |

---

## 5. Key Components (Overview)

### 5.1 Shell and layout

- **AdminDashboard** – Router, `AppProvider`, route tree, `AdminLayout` with sidebar and `<Outlet />`.
- **AdminLayout** – Sidebar (nav from `ADMIN_NAV_ITEMS`), “Return to Home”, “Sign out”.
- **AdminLoginGate** – Login prompt; subscribes to Supabase auth; dispatches `showAuthModal` when unauthenticated; on admin profile, sets cookie and redirects to admin root.

### 5.2 Shared editor UI

- **EditorHeader** – Back button (navigate), title, optional actions slot.
- **StatusMessage** – Error/success/warning/info banner with optional dismiss.
- **EditorMetaForm** – Reusable meta fields (e.g. title, description, difficulty) for editors.

### 5.3 List / table components

- **ProgramLibraryTable** – Programs list (Supabase), edit/delete, optional delete modal.
- **WorkoutLibraryTable** – Workouts list (Firebase), filter by zone, edit link.
- **ChallengeLibraryTable** – Challenges list (Firebase), edit, images panel.

### 5.4 Builders and editors

- **ScheduleBuilder** – Grid by `durationWeeks` × 7 days; fetches workouts for program (Supabase); add workout (create + link), edit (navigate to `/admin/workouts/:id`), delete.
- **ProgramBlueprintEditor** – (Used in program flow; blueprint/structure editing.)
- **ChallengeBlueprintEditor** – Challenge structure/sections.
- **WorkoutEditor** – Blocks with exercises; uses Supabase workout-details.
- **ExerciseBlockEditor** – Modal for one exercise block (name, sets/reps/RPE/rest or work/rest/rounds, coach notes).
- **ExerciseBlockList** / **ExerciseBlockCard** – List/card of blocks in a workout.
- **WarmupLikeBlockList** – Warm-up style block list.

### 5.5 Modals (pickers, generators, AI)

- **ChallengeGeneratorModal** – Create challenge (Firebase + Supabase equipment).
- **ProgramGeneratorModal** – Generate program (Firebase equipment + program-persistence).
- **WorkoutGeneratorModal** – Generate workout.
- **ExerciseVisualizationLabModal** – AI exercise imagery.
- **ExerciseSwapModal**, **ExercisePreviewModal** – Swap or preview exercise in WOD.
- **ExerciseMapPickerModal**, **ExerciseReferenceImagePicker** – Pick exercise for mapping/reference.
- **CommonMistakesSelectModal**, **BiomechanicalAnalysisSelectModal** – Select content for exercise detail.
- **BiomechanicsAIEditor**, **DeepDiveEditor** – Edit biomechanics / deep-dive content.
- **AddImageModal**, **AddVideoModal** – Add media to exercise.
- **RegenerateImageModal**, **ChallengeImageGenerateModal**, **ChallengeImagesPanel** – Image generation/management for challenges and exercises.

### 5.6 Other

- **ArchitectBlueprintPreview** / **BlueprintPreview** – Blueprint preview.
- **ScheduleViewer** – Read-only schedule view.
- **ChainDebugPanel** – Debug for prompt chain.
- **AdminExerciseDetailWrapper** – Orchestrates exercise detail page: load by slug, status, all modals and editors above.

---

## 6. API Routes (Admin)

All under `src/pages/api/admin/`; typically call `verifyAdminRequest(request)` (or equivalent) then delegate to Supabase or Firebase:

- **stats** – GET; Firebase `getDashboardStats()`.
- **users** – GET list; **users/[uid]/revoke** – revoke.
- **programs** – index and **[programId]** (CRUD).
- **workouts** – index and **[workoutId]** (CRUD).
- **challenges** – index, **[challengeId]** (CRUD), **challenges/[challengeId]/images**, **generate-image**.
- **exercises/[id]** – **update-deep-dive**, **generate-exercise-video**, **generate-biomechanics**, **generate-page**.
- **check-image-env** – env check for image generation.

Data access is a mix of Supabase client and Firebase admin SDK depending on the feature.

---

## 7. Styling and UX

- **Theme:** Dark background `#0d0500`, white/white-60 text, borders `white/10`, accent `#ffbf00` (gold) for primary actions and active nav.
- **Patterns:** Cards with `border border-white/10 bg-black/20 backdrop-blur-sm`; buttons: outline for secondary, gold for primary; loading states (e.g. Loader2); `StatusMessage` for feedback.
- **Icons:** Lucide React throughout.
- **Motion:** Framer Motion in some modals (e.g. `AnimatePresence` in `ExerciseBlockEditor`).

---

## 8. Observations and Recommendations

### Strengths

- **Single nav source of truth** in `navigation.ts`; easy to add/remove sidebar items.
- **Configurable base path** via env for white-label or path change.
- **Consistent editor patterns:** `EditorHeader`, `StatusMessage`, load/save/error state handling.
- **Clear split:** List views (“Manage*”) vs editor views (“*Editor”) vs “Engine” views (WOD, WarmUp).
- **Server-side admin check** on both login and dashboard pages and on API routes.

### Hybrid backend

- **Supabase** is used for auth, programs, workouts, exercises, zones, warm-up.
- **Firebase** is still used for challenges, WODs, dashboard stats, and one program-generator flow.
- **Recommendation:** Document migration status (e.g. “Challenges/WODs to move to Supabase”) and avoid adding new Firebase-only admin features if the target is Supabase-only.

### Navigation

- Some “create” flows use **full page redirect** (`window.location.href = /admin/...`) instead of React Router `navigate()`, which can be unified later for a more SPA-like feel.

### Astro vs React

- Admin dashboard is **client-only** React (`client:only="react"`). No SSR of admin UI; auth and gating are done in Astro and API routes. This is consistent and simple.

### Tests

- Firebase admin auth/contract tests live under `src/lib/firebase/admin/__tests__/`. No dedicated tests under `src/components/react/admin/` were found; adding tests for critical flows (e.g. login gate, program create → edit) would improve reliability.

---

## 9. File Count Summary

- **React admin components:** ~50+ under `src/components/react/admin/` (views, modals, tables, editors, shared).
- **Admin pages:** 2 Astro pages (login, catch-all).
- **Admin API routes:** 15+ endpoints under `src/pages/api/admin/`.
- **Admin lib:** 2 files (`config`, `navigation`); backend logic in `src/lib/supabase/admin/` and `src/lib/firebase/admin/`.

This audit reflects the state of the codebase as of the audit date. For migration or refactor plans, cross-reference with any existing Supabase/Firebase migration docs.
