# Admin Exercises & Visualization Lab — Review and Improvement Plan

This document reviews how the **programs** admin exercises flow is set up and how it can work more elegantly and harmoniously with the **Visualization Lab** (Exercise Image Generator).

---

## 1. Current Setup Summary

### 1.1 Entry Points and Routes

| Route                       | Component                                                | Purpose                                                                                        |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/admin/exercises`          | `ManageExercises`                                        | Three tabs: Exercise Library (all), Generated Exercises, Manually Added                        |
| `/admin/exercises/:slug`    | `AdminExerciseDetailWrapper` → `GeneratedExerciseDetail` | View/edit a single generated exercise: status, images, biomechanics, deep dive, videos         |
| `/admin/exercise-image-gen` | `ExerciseImageGenerator` (Viz Lab)                       | Create new exercises: topic → generate image(s) + instructions → save to `generated_exercises` |

Navigation (sidebar): **Exercises** and **Visualization Lab** are separate nav items. ManageExercises has a prominent "Visualization Lab" button and (on Generated tab) "Generate New Exercise" linking to `/exercise-image-gen`.

### 1.2 Data Model

- **`generated_exercises`** (Supabase): Canonical AI-generated exercises. Created by the Visualization Lab or WOD Engine modal. Fields: slug, exerciseName, imageUrl, storagePath, biomechanics, status (pending/approved/rejected), deepDiveHtmlContent, etc.
- **`exercise_images`** (Supabase): Gallery/carousel images per exercise (sequenceStart, sequenceMid, sequenceEnd, primary, anatomical). Populated by Viz Lab (on save when 3-image mode) or by AdminExerciseDetail (Add Image / Regenerate modals).
- **`exercises`** (Supabase): Manually added exercises (name, category, muscleGroups, videoUrl, defaultEquipment). No slug, no biomechanics, no image from Viz Lab. Used for legacy or non-AI library entries.

**Exercise Library** tab merges both: manual + generated in one list. **Generated** tab shows only `generated_exercises` with status filter (all / pending / approved / rejected).

### 1.3 Flow: Create → Review → Publish

1. **Create**: User goes to Visualization Lab → enters topic, options → Generate → Save Exercise. Record is created in `generated_exercises` (status `pending`), images in storage + `exercise_images` if 3-image sequence.
2. **Review**: From ManageExercises (Library or Generated tab) user clicks a generated exercise → AdminExerciseDetail (by slug). There they can approve/reject, regenerate primary image, add gallery images, edit biomechanics, generate/edit deep dive, add videos.
3. **Publish**: In ManageExercises Generated tab, "Publish" (upload icon) sets status to `approved`. "Unpublish" sets back to `pending`.

Post-save in Viz Lab: "View Exercise (Admin)" links to `/exercises/:slug` (admin detail), so the user can go straight to review after creating.

---

## 2. How It Connects to the Visualization Lab

- **Viz Lab creates the base**: name, primary image, biomechanics (performance cues, etc.), sources. That is the "foundational unit" for the exercise.
- **AdminExerciseDetail refines**: status, extra images (carousel), deep dive HTML, videos, common mistakes / biomechanical analysis (pulled from other exercises or edited).
- **Shared storage**: Both use `uploadExerciseImage()` and the same bucket (`exercise-images`). Paths: `generated-exercises/{userId}/{slug}-{ts}.png`.
- **Shared APIs**: `createGeneratedExercise`, `updateGeneratedExercise`, `addExerciseImage`, `getExerciseImages` from Supabase client.

So: **Viz Lab = create base; Admin Detail = refine and publish.** The split is clear; the main gaps are around **edit flow** and **discoverability**.

---

## 3. Friction Points and Inconsistencies

### 3.1 Two Places to Add/Regenerate Images

- **Visualization Lab**: Create new exercise + optional 3-image sequence in one go. No way to "open" an existing exercise and add another variant or regenerate from here.
- **AdminExerciseDetail**: Regenerate Image modal (replace primary), Add Image modal (add to gallery). Same backend (Gemini-style flow in modals) but different UI and entry point.

So "add another image" or "regenerate with different style" can be done only from the detail page, not from the Lab. If the Lab is the canonical place for "images + instructions," having edit-by-slug in the Lab would make the mental model simpler.

### 3.2 No "Edit in Visualization Lab" from Detail

From AdminExerciseDetail there is no link/action like "Edit in Visualization Lab" or "Add variant in Lab." The user must use the in-detail modals (Regenerate Image, Add Image). For consistency and reuse of Lab UX (templates, reference image, demographics), an option to open the Lab with exercise pre-loaded (topic, style) and either update the existing record or add gallery images would align the two surfaces.

### 3.3 Library Tab: Mixed Types, Different Behaviors

- **Generated** cards: Click → `/exercises/:slug` (admin detail). Full workflow.
- **Manual** cards: No link to a detail page. Manual exercises don’t have a slug in `generated_exercises`; they live only in `exercises`.

So in the same "Exercise Library" view, some rows are clickable to a rich detail page and others are not. Options: add a simple "View/Edit" for manual (e.g. modal or minimal detail page) or make the distinction clearer (e.g. "From Visualization Lab" vs "Manually added").

### 3.4 Terminology

- "Exercise Library" = merged list (manual + generated).
- "Generated Exercises" = only generated, with status filter.
- "Visualization Lab" = create (and in a future state, edit) generated exercises.

The doc that calls the Lab "the foundational unit" is consistent with this; the UI could reinforce it (e.g. "From Visualization Lab" or "Create in Lab" instead of only "Generate New Exercise").

### 3.5 getGeneratedExercises() in Library

Library tab calls `getGeneratedExercises()` with **no** status filter, so it shows all statuses (pending, approved, rejected). That’s correct for an admin "see everything" view. Generated tab uses the same API with a status filter. No change needed; just noted for clarity.

---

## 4. Recommendations for Elegance and Harmony

### 4.1 Unify "Add/Regenerate Image" with the Lab (Medium Effort)

- **Option A — Edit mode in Visualization Lab**: Add an "Edit exercise" mode: navigate to `/exercise-image-gen?slug=bodyweight-squat` (or similar). Lab loads existing exercise (topic, style, etc.), allows regenerating primary or adding gallery images; saves update to the same `generated_exercises` row and `exercise_images`. One place for all image generation.
- **Option B — Keep modals, add "Open in Lab"**: In AdminExerciseDetail, add a button "Add variant in Visualization Lab" that deep-links to the Lab with topic (and optionally slug) pre-filled. Lab could still create a _new_ exercise by default, but with topic pre-filled the user can generate and then in Detail "add to gallery" from… that would require either Lab supporting "add to existing" or copying the flow. So Option A is cleaner long-term.

Recommendation: **Option A** — extend the Lab with an edit-by-slug mode so that "create" and "edit/add images" both go through the same UX and the Lab remains the single place for image + instruction generation.

### 4.2 Clearer Navigation and Copy

- In **ManageExercises**: Keep "Visualization Lab" as primary CTA; add short copy under the Generated tab: e.g. "Exercises created in the Visualization Lab. Approve to publish to the site."
- In **AdminExerciseDetail**: Add a link or button: "Add another image in Visualization Lab" (or "Edit in Visualization Lab" when edit mode exists) so the path from detail → Lab is explicit.
- In **ExerciseImageGenerator** (Viz Lab): After save, the existing "View Exercise (Admin)" is good; consider adding "Publish" shortcut (e.g. "View & Publish") that goes to detail with a hint to use Publish there, or leave Publish only in ManageExercises/Detail for simplicity.

### 4.3 Library Tab: Clarify or Unify Behavior

- **Option A**: Add a minimal "View" for manual exercises (e.g. modal or `/exercises/manual/:id` with name, category, muscle groups, video, edit/delete). Makes Library behavior consistent (every row clickable).
- **Option B**: Visually separate "From Visualization Lab" and "Manually added" in the Library (e.g. subsections or badges) and only link generated rows to detail; keep manual as cards without a detail page but with edit/delete on the card or in a modal.

Recommendation: **Option B** is lighter and keeps the canonical "exercise" (slug, public page) for generated only; Option A is better if you want a single "exercise detail" concept for both types later.

### 4.4 Single Source of Truth Messaging

- In **docs** and **UI**: State clearly that "Exercises with images and instructions come from the Visualization Lab; the admin exercise detail is where you approve, add more images, and add deep dive/videos."
- Sidebar: Keeping "Exercises" and "Visualization Lab" as two items is fine; the in-page links (ManageExercises → Lab, Detail → Lab, Lab → Detail) already tie them together. Optional: tooltip or short description under "Visualization Lab" like "Create and edit exercise images & instructions."

---

## 5. Summary

| Aspect            | Current state                                                        | Suggested direction                                                      |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Create flow       | Viz Lab → Save → appears in Generated / Library                      | Keep; add post-save "View Exercise (Admin)" (already there).             |
| Edit / add images | Only in AdminExerciseDetail (Regenerate / Add Image modals)          | Add edit mode in Viz Lab (load by slug, update existing or add gallery). |
| Navigation        | Exercises + Visualization Lab separate; ManageExercises links to Lab | Add "Add variant in Lab" (or "Edit in Lab") from AdminExerciseDetail.    |
| Library tab       | Mixed manual + generated; only generated link to detail              | Clarify sections or badges; optional minimal view for manual.            |
| Terminology       | "Generated Exercises", "Visualization Lab"                           | Reinforce "From Visualization Lab" and "Create in Lab" in copy.          |

Implementing **edit-by-slug in the Visualization Lab** (and a clear link from AdminExerciseDetail to the Lab) would make the system more elegant and harmonious: one place for creating and editing the foundational unit (images + instructions), with the admin detail focused on status, gallery ordering, deep dive, and videos.
