# Content Generation Lab — Phased Roadmap

Phased plan for fixing remaining issues and implementing the optional design-system. Based on [EXERCISE_IMAGE_GENERATOR_MIGRATION_CHECKLIST.md](./EXERCISE_IMAGE_GENERATOR_MIGRATION_CHECKLIST.md) and [CONTENT_GENERATION_LAB_MIGRATION_REVIEW.md](./CONTENT_GENERATION_LAB_MIGRATION_REVIEW.md).

---

## Overview

| Phase | Scope | Priority |
|-------|--------|----------|
| **1** | `buildExerciseVideoPrompt` — fix build failure | Critical |
| **2** | SQL scripts — add missing docs | Medium |
| **3** | Duplicate entry points — canonicalize routing | Medium |
| **4** | Design-system (optional) | Low |

---

## Phase 1: Critical — Fix Build Failure

**Goal:** Unblock `npm run build --workspace=app`.

### Problem

`generate-exercise-video.ts` imports `buildExerciseVideoPrompt` from `@/lib/gemini-server`, but that function is not defined there.

```ts
// apps/app/src/pages/api/admin/exercises/[id]/generate-exercise-video.ts
import { buildExerciseVideoPrompt } from '@/lib/gemini-server';
// ...
const promptText = await buildExerciseVideoPrompt(exercise.exerciseName, performanceCues, {
  biomechanicalChain: biomechanics.biomechanicalChain,
  pivotPoints: biomechanics.pivotPoints,
  stabilizationNeeds: biomechanics.stabilizationNeeds,
  commonMistakes,
});
```

### Options

| Option | Effort | Description |
|--------|--------|-------------|
| **A. Implement** | Medium | Add `buildExerciseVideoPrompt` to `gemini-server.ts`. Takes `(exerciseName, performanceCues, options)` and returns a prompt string for Runway/Gemini Veo. |
| **B. Stub** | Low | Export a stub that returns a placeholder prompt (e.g. `"Smooth, controlled motion of ${exerciseName}"`) until full implementation. |
| **C. Remove** | Low | Remove or comment out the generate-exercise-video API and its import if video generation is not needed yet. |

### Recommended Implementation (Option A)

Add to `gemini-server.ts`:

```ts
export interface BuildExerciseVideoPromptOptions {
  biomechanicalChain?: string[];
  pivotPoints?: string[];
  stabilizationNeeds?: string[];
  commonMistakes?: string[];
}

export async function buildExerciseVideoPrompt(
  exerciseName: string,
  performanceCues: string[],
  options: BuildExerciseVideoPromptOptions
): Promise<string> {
  const parts: string[] = [
    `Demonstrate correct form for: ${exerciseName}.`,
    'Smooth, controlled motion. Professional fitness instruction video.',
  ];
  if (performanceCues.length > 0) {
    parts.push(`Key cues: ${performanceCues.join('. ')}`);
  }
  if (options.pivotPoints?.length) {
    parts.push(`Focus on joint movement at: ${options.pivotPoints.join(', ')}`);
  }
  if (options.commonMistakes?.length) {
    parts.push(`Avoid: ${options.commonMistakes.join('; ')}`);
  }
  return parts.join(' ');
}
```

### Acceptance Criteria

- [ ] `npm run build --workspace=app` succeeds
- [ ] `buildExerciseVideoPrompt` is exported from `gemini-server.ts`
- [ ] Generate-exercise-video API runs without runtime errors (prompt quality can be refined later)

---

## Phase 2: SQL Scripts — Add Missing Documentation

**Goal:** Provide Supabase setup documentation so manual setup or reference is possible.

### Problem

Checklist expects:

- `docs/SUPABASE_VISUALIZATION_LAB_SETUP.sql`
- `docs/VIZ_LAB_TEMPLATES_SCHEMA.sql`

Neither exists. Schema is already in migrations; these docs serve as reference for onboarding, setup instructions, or external projects.

### Approach

Create reference SQL documents that either:

1. **Mirror migrations** — Copy canonical SQL from `supabase/migrations/` and `apps/app/supabase/migrations/` into docs with clear headers.
2. **Link to migrations** — Create docs that reference migration files and summarize tables/buckets.

### Files to Create

| File | Content |
|------|---------|
| `docs/SUPABASE_VISUALIZATION_LAB_SETUP.sql` | Tables: `generated_exercises`, `exercise_images`; storage bucket `exercise-images`; RLS policies. Reference: `00001_initial_schema.sql`, `00002_exercise_images.sql`, `00061_storage_exercise_images_bucket.sql`, `00022_rls_generated_exercises.sql`, etc. |
| `docs/VIZ_LAB_TEMPLATES_SCHEMA.sql` | Table: `viz_lab_templates` with RLS. Reference: `supabase/migrations/20250316000000_viz_lab_templates.sql`. |

### Notes

- Migrations remain the source of truth. Docs are for human reference.
- Include a header in each file: "For reference only. Apply via `supabase db push` or use migrations."

### Acceptance Criteria

- [ ] `docs/SUPABASE_VISUALIZATION_LAB_SETUP.sql` exists and documents core Viz Lab tables and bucket
- [ ] `docs/VIZ_LAB_TEMPLATES_SCHEMA.sql` exists and documents `viz_lab_templates`
- [ ] Checklist updated if paths differ from expectations

---

## Phase 3: Duplicate Entry Points — Canonicalize Routing

**Goal:** Single canonical route for `/admin/exercise-image-gen` with consistent auth and layout.

### Current State

| Entry Point | File | Auth | Layout |
|-------------|------|------|--------|
| **Standalone** | `admin/exercise-image-gen.astro` | **None** | BaseLayout, light gray bg |
| **Admin shell** | `admin/[...slug].astro` → `AdminDashboard` → `ExerciseImageGenView` | `verifyAdminRequest` | Dark admin sidebar + content |

Astro prefers the more specific `exercise-image-gen.astro`, so the **standalone page** serves `/admin/exercise-image-gen`. The AdminDashboard route is never reached. The standalone page has **no admin auth**.

### Recommendation

**Canonical:** AdminDashboard (inside `[...slug].astro`).

**Reasons:**

1. **Security** — Admin routes should require `verifyAdminRequest`.
2. **Consistency** — Other admin pages (exercises, programs, etc.) use the shell.
3. **Navigation** — Sidebar links expect the lab inside the admin layout.

### Actions

1. **Delete** `apps/app/src/pages/admin/exercise-image-gen.astro`.
2. **Ensure** `admin/[...slug].astro` matches `/admin/exercise-image-gen` (it does; `slug` = `"exercise-image-gen"`).
3. **Verify** `AdminDashboard` renders `ExerciseImageGenView` at path `exercise-image-gen` (already configured).
4. **Confirm** `ExerciseImageGenerator` styling works inside the dark admin shell (currently uses `#ffbf00` accents and dark backgrounds; should be compatible).

### Edge Case: Index Route

`[...slug].astro` may not match `/admin` (no slug). Confirm `/admin` is served by a different file (e.g. `admin/index.astro`) or that the catch-all handles it. If `/admin` redirects to `/admin/` and React Router index route shows `DashboardHome`, no change needed.

### Acceptance Criteria

- [ ] Only one implementation serves `/admin/exercise-image-gen`
- [ ] `/admin/exercise-image-gen` requires admin auth
- [ ] Lab appears inside admin shell with sidebar
- [ ] All internal links to `/exercise-image-gen` (from ManageExercises, AdminExerciseDetailWrapper, etc.) continue to work
- [ ] Test: `ADMIN_PAGE_ROUTES` in `admin-auth.test.ts` still covers `/admin/exercise-image-gen`

---

## Phase 4 (Optional): Design-System

**Goal:** Optionally introduce a shared design-system package for consistent styling across the app.

### Current State

- App uses `global.css` and Tailwind.
- No `packages/design-system` in this monorepo.
- Checklist marks design-system as optional ("if not already in target").
- [CONTENT_GENERATION_LAB_MIGRATION_REVIEW.md](./CONTENT_GENERATION_LAB_MIGRATION_REVIEW.md): "App uses global.css and Tailwind; no design-system package required."

### Options

| Option | Effort | Description |
|--------|--------|-------------|
| **A. Skip** | None | Continue with global.css + Tailwind. No design-system package. |
| **B. Add package** | High | Create `packages/design-system` with tokens, base styles, shared components. Migrate app to use it. |
| **C. Consolidate tokens** | Medium | Extract CSS variables / Tailwind theme (colors, spacing, typography) into a small shared module or `tokens.css` without a full design-system package. |

### Recommendation

**Option A (Skip)** unless:

- Multiple apps in the monorepo need shared design tokens.
- Design handoff requires a formal design-system.
- You have bandwidth for a larger refactor.

If you adopt Option C, create `apps/app/src/styles/tokens.css` (or similar) and import it in `global.css`. Minimal change, some consistency gain.

### Acceptance Criteria (if implementing)

- [ ] Design tokens (colors, spacing, typography) defined in one place
- [ ] App or design-system package consumes tokens
- [ ] No regressions in existing UI

---

## Suggested Order

1. **Phase 1** — Unblock the build (required).
2. **Phase 2** — Add SQL docs when convenient (improves onboarding).
3. **Phase 3** — Fix duplicate entry points and auth (security and UX).
4. **Phase 4** — Design-system only if needed (optional).

---

## References

- [EXERCISE_IMAGE_GENERATOR_MIGRATION_CHECKLIST.md](./EXERCISE_IMAGE_GENERATOR_MIGRATION_CHECKLIST.md)
- [CONTENT_GENERATION_LAB_MIGRATION_REVIEW.md](./CONTENT_GENERATION_LAB_MIGRATION_REVIEW.md)
- [ADMIN_EXERCISES_AND_VIZ_LAB_REVIEW.md](../apps/app/docs/features/exercises/ADMIN_EXERCISES_AND_VIZ_LAB_REVIEW.md)
- `supabase/migrations/20250316000000_viz_lab_templates.sql`
- `apps/app/supabase/migrations/` (generated_exercises, exercise_images, exercise-images bucket)
