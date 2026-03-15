# Exercise Image Generator / Content Generation Lab — Migration Checklist

Use this checklist when copying the Exercise Image Generator (Content Generation Lab) to another project. It lists all required files, API keys, and setup steps.

---

## Quick reference: all file paths

```
# Admin app (apps/admin-dash-astro)
src/components/ExerciseImageGenerator.tsx
src/components/react/ReferenceImagePicker.tsx
src/components/react/admin/ExerciseReferenceImagePicker.tsx
src/hooks/useVisualizationLab.ts
src/pages/api/generate-exercise-image.ts
src/pages/api/load-reference-image.ts
src/lib/gemini-server.ts
src/lib/parse-biomechanics.ts
src/lib/data-url-to-blob.ts
src/lib/visualization-lab/types.ts
src/lib/visualization-lab/demographics-presets.ts
src/lib/visualization-lab/templates.ts
src/lib/visualization-lab/export.ts
src/lib/visualization-lab/preview-payload.ts
src/lib/supabase/client.ts
src/lib/supabase/client/storage.ts
src/lib/supabase/client/generated-exercises.ts
src/lib/supabase/client/exercise-gallery.ts
src/lib/supabase/client/viz-lab-templates.ts
src/types/generated-exercise.ts
src/types/timestamp.ts
src/features/TutorialLab/types/tutorial.ts

# Packages
packages/content-generation-lab/   (entire directory)
packages/exercise-mapping/         (if not already in target)
packages/design-system/            (if not already in target)

# Docs & SQL
docs/SUPABASE_VISUALIZATION_LAB_SETUP.sql
docs/VIZ_LAB_TEMPLATES_SCHEMA.sql
docs/SUPABASE_VISUALIZATION_LAB.md   (reference)
```

---

## 1. Required Files

### 1.1 Main component & hooks

| File | Description |
|------|-------------|
| `src/components/ExerciseImageGenerator.tsx` | Main UI: form, templates, reference image, generate → preview → save |
| `src/hooks/useVisualizationLab.ts` | Form state, reference image, generation logic; wraps `useContentGenerationLab` |

### 1.2 React sub-components

| File | Description |
|------|-------------|
| `src/components/react/ReferenceImagePicker.tsx` | Use last generated, from exercise library, or paste URL |
| `src/components/react/admin/ExerciseReferenceImagePicker.tsx` | Search exercises and pick primary/gallery image as reference |

### 1.3 API routes

| File | Description |
|------|-------------|
| `src/pages/api/generate-exercise-image.ts` | POST: research + image generation (uses Gemini) |
| `src/pages/api/load-reference-image.ts` | GET: proxy to load reference image and return base64 (avoids CORS) |

### 1.4 Lib — Gemini / image generation

| File | Description |
|------|-------------|
| `src/lib/gemini-server.ts` | Gemini API client; research topic, generate infographic image |

### 1.5 Lib — Visualization Lab

| File | Description |
|------|-------------|
| `src/lib/visualization-lab/types.ts` | `BiomechanicalPoints`, `ResearchOnlyResult`, `SearchChunk` |
| `src/lib/visualization-lab/demographics-presets.ts` | `DEMOGRAPHICS_PRESETS` |
| `src/lib/visualization-lab/templates.ts` | `VizLabTemplate`, load/save/delete from localStorage |
| `src/lib/visualization-lab/export.ts` | Download image and metadata JSON |
| `src/lib/visualization-lab/preview-payload.ts` | `buildSaveExercisePreview` for Save Exercise flow |

### 1.6 Lib — Parse biomechanics

| File | Description |
|------|-------------|
| `src/lib/parse-biomechanics.ts` | `parseBiomechanicalPoints`, `transformSearchResultsToSources`, `generateSlug` |

### 1.7 Lib — Data utilities

| File | Description |
|------|-------------|
| `src/lib/data-url-to-blob.ts` | Convert data URL to Blob for upload |

### 1.8 Lib — Supabase client

| File | Description |
|------|-------------|
| `src/lib/supabase/client.ts` | Supabase browser client |
| `src/lib/supabase/client/storage.ts` | `uploadExerciseImage` |
| `src/lib/supabase/client/generated-exercises.ts` | CRUD for `generated_exercises` |
| `src/lib/supabase/client/exercise-gallery.ts` | `addExerciseImage`, etc. |
| `src/lib/supabase/client/viz-lab-templates.ts` | `listVizLabTemplates`, `createVizLabTemplate`, `deleteVizLabTemplate` |

### 1.9 Types

| File | Description |
|------|-------------|
| `src/types/generated-exercise.ts` | `GeneratedExercise`, `ExerciseImage`, `ParsedBiomechanics`, etc. |
| `src/types/timestamp.ts` | `TimestampLike`, `toTimestampLike` |
| `src/features/TutorialLab/types/tutorial.ts` | `ExerciseConfig` (used by `generated-exercise` and `gemini-server`) |

### 1.10 Packages (workspace)

| Package | Path | Description |
|---------|------|-------------|
| `@workout-generator/content-generation-lab` | `packages/content-generation-lab/` | Shared shell/hook for two-phase research → image flow |
| `@workout-generator/exercise-mapping` | `packages/exercise-mapping/` | `normalizeExerciseName` (used by `generated-exercises`) |
| `@workout-generator/design-system` | `packages/design-system/` | Base styles; imported in layout |

**content-generation-lab package files** (copy entire directory):
- `packages/content-generation-lab/package.json`
- `packages/content-generation-lab/tsconfig.json`
- `packages/content-generation-lab/src/index.ts`
- `packages/content-generation-lab/src/types.ts`
- `packages/content-generation-lab/src/useReferenceImage.ts`
- `packages/content-generation-lab/src/useGenerationState.ts`
- `packages/content-generation-lab/src/useContentGenerationLab.ts`
- `packages/content-generation-lab/src/ContentGenerationLab.tsx`

The other packages may already exist in your monorepo.

---

## 2. SQL setup (Supabase)

Run these in your Supabase project (SQL Editor):

| File | Purpose |
|------|---------|
| `docs/SUPABASE_VISUALIZATION_LAB_SETUP.sql` | Tables `generated_exercises`, `exercises`, `exercise_images`; bucket `exercise-images`; RLS |
| `docs/VIZ_LAB_TEMPLATES_SCHEMA.sql` | Table `viz_lab_templates` (optional; fallback is localStorage) |

---

## 3. Environment variables & API keys

### Required

| Variable | Where used | Description |
|----------|------------|-------------|
| `GEMINI_API_KEY` | `src/lib/gemini-server.ts`, `src/pages/api/generate-exercise-image.ts` | Google AI Studio key; used for research + image generation |
| `PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts`, `src/pages/api/load-reference-image.ts` | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/client.ts` | Supabase anon key |

### Optional

| Variable | Where used | Description |
|----------|------------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server/admin code (e.g. `generated-exercises-server`, auth) | For admin operations |
| `PUBLIC_SITE_URL` | Admin links, “Return to site” | Main site URL |

### .env.example (relevant section)

```env
# Supabase (same project as programs for shared admin)
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Visualization Lab (Exercise Image Generator)
GEMINI_API_KEY=

# Optional
PUBLIC_SITE_URL=https://yoursite.com
```

**Security:**

- `GEMINI_API_KEY` must **never** be exposed to the client. It is only used in `gemini-server.ts` and the `generate-exercise-image` API route (server-only).
- `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are used on the client and in the load-reference-image allowlist; this is intentional.

---

## 4. NPM dependencies (package.json)

```json
{
  "dependencies": {
    "@google/genai": "^1.29.0",
    "@supabase/supabase-js": "^2.97.0",
    "@workout-generator/content-generation-lab": "*",
    "@workout-generator/design-system": "*",
    "@workout-generator/exercise-mapping": "*",
    "lucide-react": "^0.553.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.13.0",
    "sonner": "^2.0.7"
  }
}
```

Adjust versions to match your project. Other admin-dash-astro deps (e.g. `@astrojs/react`, `tailwind`, etc.) may already exist.

---

## 5. Routing & layout

- Add route for `/exercise-image-gen` (or equivalent) that renders `ExerciseImageGenerator`.
- Ensure layout imports `@workout-generator/design-system` (or equivalent base styles).
- Configure Vite/Astro `resolve.alias` so `@/` points to `src/`.

---

## 6. Cross-cutting dependencies

- **Supabase Auth**: `ExerciseImageGenerator` uses `user` from `useVisualizationLab` (Supabase session). Ensure your app has an auth context or equivalent.
- **Toasts**: Uses `sonner` (`toast.success`, `toast.error`). Ensure Toaster is rendered in your layout.

---

## 7. Minimal copy order

1. Types: `timestamp.ts`, `generated-exercise.ts`, `TutorialLab/types/tutorial.ts`
2. Supabase client: `client.ts`, `storage.ts`, `generated-exercises.ts`, `exercise-gallery.ts`, `viz-lab-templates.ts`
3. Lib: `parse-biomechanics.ts`, `data-url-to-blob.ts`, `gemini-server.ts`
4. Viz lab lib: `types.ts`, `demographics-presets.ts`, `templates.ts`, `export.ts`, `preview-payload.ts`
5. Packages: `content-generation-lab` (entire package)
6. Hooks: `useVisualizationLab.ts`
7. Components: `ReferenceImagePicker.tsx`, `ExerciseReferenceImagePicker.tsx`, `ExerciseImageGenerator.tsx`
8. API routes: `generate-exercise-image.ts`, `load-reference-image.ts`
9. SQL scripts: `SUPABASE_VISUALIZATION_LAB_SETUP.sql`, `VIZ_LAB_TEMPLATES_SCHEMA.sql`
10. Env: copy relevant vars into `.env.example` and `.env`
