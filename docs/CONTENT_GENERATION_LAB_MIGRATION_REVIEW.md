# Content Generation Lab — Migration Review

Review of the migration completed using [EXERCISE_IMAGE_GENERATOR_MIGRATION_CHECKLIST.md](./EXERCISE_IMAGE_GENERATOR_MIGRATION_CHECKLIST.md).

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| 1.1 Main component & hooks | OK | All present |
| 1.2 React sub-components | OK | All present |
| 1.3 API routes | OK | All present |
| 1.4 Lib — Gemini | OK | Present; see Issue 1 below |
| 1.5 Lib — Visualization Lab | OK | All present |
| 1.6 Lib — Parse biomechanics | OK | Present |
| 1.7 Lib — Data utilities | OK | Present |
| 1.8 Lib — Supabase client | OK | All present |
| 1.9 Types | OK | All present |
| 1.10 Packages | OK | content-generation-lab, exercise-mapping present |
| 2. SQL setup | Missing | Schema scripts not in docs |
| 5. Routing | OK | `/admin/exercise-image-gen` configured |
| 6. Cross-cutting | OK | Auth, toasts in place |

---

## Required Files Verified

### Present in `apps/app/`

| Section | Files |
|---------|-------|
| 1.1 | `ExerciseImageGenerator.tsx`, `useVisualizationLab.ts` |
| 1.2 | `ReferenceImagePicker.tsx`, `ExerciseReferenceImagePicker.tsx` |
| 1.3 | `generate-exercise-image.ts`, `load-reference-image.ts` |
| 1.4 | `gemini-server.ts` |
| 1.5 | `visualization-lab/types.ts`, `demographics-presets.ts`, `templates.ts`, `export.ts`, `preview-payload.ts` |
| 1.6 | `parse-biomechanics.ts` |
| 1.7 | `data-url-to-blob.ts` |
| 1.8 | `client.ts`, `storage.ts`, `generated-exercises.ts`, `exercise-gallery.ts`, `viz-lab-templates.ts` |
| 1.9 | `generated-exercise.ts`, `timestamp.ts`, `TutorialLab/types/tutorial.ts` |

### Packages Present

| Package | Path | Files |
|---------|------|-------|
| `@interval-timers/content-generation-lab` | `packages/content-generation-lab/` | package.json, tsconfig.json, index.ts, types.ts, useReferenceImage.ts, useGenerationState.ts, useContentGenerationLab.ts, ContentGenerationLab.tsx |
| `@interval-timers/exercise-mapping` | `packages/exercise-mapping/` | Present |

### Optional / Not Applicable

- **design-system**: Checklist marks as optional ("if not already in target"). App uses `global.css` and Tailwind; no design-system package required.

---

## Issues to Fix

### 1. ~~Build failure: missing `generateBiomechanicsForExercise`~~ (Fixed)

**Resolved:** `generateBiomechanicsForExercise` and `BiomechanicsFocus` have been added to `gemini-server.ts`.

### 1b. Build failure: missing `buildExerciseVideoPrompt` (Critical)

**File:** `apps/app/src/pages/api/admin/exercises/[id]/generate-exercise-video.ts`

**Problem:** Imports `buildExerciseVideoPrompt` from `@/lib/gemini-server`, but it is not exported.

**Impact:** `npm run build --workspace=app` still fails.

**Action:** Add `buildExerciseVideoPrompt` to `gemini-server.ts` or remove/fix the generate-exercise-video API. (This is separate from the content-generation-lab migration.)

### 2. SQL schema scripts missing (Medium)

**Checklist expects:**

- `docs/SUPABASE_VISUALIZATION_LAB_SETUP.sql`
- `docs/VIZ_LAB_TEMPLATES_SCHEMA.sql`

**Status:** Neither file exists in the repo.

**Impact:** Manual Supabase setup is harder; tables (`generated_exercises`, `exercise_images`, `viz_lab_templates`, etc.) must be created from another source or by hand.

**Action:** Add these SQL scripts under `docs/` or document where the equivalent schemas live.

---

## Routing & Entry Points

Two entry points for the Content Generation Lab:

1. **Admin dashboard (React)**  
   - Path: `/admin/exercise-image-gen`  
   - Rendered via `AdminDashboard` → `ExerciseImageGenView` (uses `ExerciseImageGenerator` in admin shell).  
   - Auth: `verifyAdminRequest` in `[...slug].astro`.

2. **Standalone Astro page**  
   - File: `apps/app/src/pages/admin/exercise-image-gen.astro`  
   - Uses `BaseLayout` and a lighter layout (gray-50).  
   - If this file exists, Astro will prefer it for `/admin/exercise-image-gen`, so the admin sidebar/shell may not be used.  

**Recommendation:** Decide whether the lab should be shown only inside the admin shell or as a standalone page, then keep a single implementation.

---

## Package naming

Checklist uses `@workout-generator/*`; this project uses `@interval-timers/*`. That’s fine as long as `package.json` and imports are consistent.

---

## Recommended Next Steps

1. Implement or remove the `generateBiomechanicsForExercise` API to fix the build.
2. Add the Supabase SQL scripts to `docs/` or update the checklist with their location.
3. Verify `viz_lab_templates` and related tables exist in Supabase and match the app’s expectations.
4. Confirm which route (`[...slug].astro` vs `exercise-image-gen.astro`) should serve the lab and remove or refactor the other if needed.
