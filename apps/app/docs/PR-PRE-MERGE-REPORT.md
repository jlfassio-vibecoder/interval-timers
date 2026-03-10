# Pre-Merge Report: Firebase → Supabase Migration (Phase 3)

**Branch:** Current branch vs `main`  
**Scope:** Admin components, ExerciseImageGenerator, WODEngine, hooks, and public components switched to Supabase auth/storage and Supabase client APIs.

---

## Fixed

| Item                            | Location                                  | Action                                                                                                                              |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Stale Firestore comment**     | `ExerciseVisualizationLabModal.tsx` ~L188 | Comment said "re-querying Firestore"; updated to "re-querying the backend" (backend is now Supabase).                               |
| **Stale Firestore comment**     | `AdminExerciseDetailWrapper.tsx` ~L224    | "Update Firestore document" → "Update generated exercise record" (step 3 still calls `updateGeneratedExercise`, which is Supabase). |
| **Stale file-header reference** | `WODEngine.tsx` ~L5                       | "save and publish to Firestore" → "save and publish (Supabase)" to match current backend.                                           |

_Previously addressed in this PR cycle:_

- **handleSaveToStorage 3-image carousel:** Added `sequenceStart` gallery entry so both save paths (handleSaveToStorage and handleSaveExercise) expose full Start/Mid/End carousel.
- **AddImageModal auth:** Single session check at top of `handleSave`; `userId` derived once and used for early return and in try block (removed duplicate `getSession()` and redundant throw).

---

## Slop Scrubbed

| Item                      | Location                     | Action                                                                                        |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| **Outdated backend name** | Three comments/headers above | Replaced "Firestore" with backend-neutral or "Supabase" where the code path is Supabase-only. |

No other redundant comments were removed. Section headers (e.g. "Upload first image and create generated exercise (Supabase)", "Create exercise_image record (Supabase)") were kept for migration context and step clarity.

---

## Ignored

| Suggestion / Check                                               | Reason                                                                                                                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copilot: indentation in ExerciseImageGenerator 3-image block** | Indentation was already correct (6 → 8 → 10 spaces); matched `handleSaveExercise` block. No change.                                                                                          |
| **Removing "(Supabase)" from step comments**                     | Kept. They document migration context and align with other Supabase comments in the same files.                                                                                              |
| **Adding `generatedBy` to WODEngine `createGeneratedWOD`**       | `createGeneratedWOD` in `src/lib/supabase/client/generated-wods.ts` sets `author_id` from `session.user.id` internally; caller must not pass `generatedBy`. Removal in WODEngine is correct. |

---

## Verification Performed

- **APIs:** Confirmed `uploadExerciseImage`, `uploadExerciseVideo`, `addExerciseImage`, `addExerciseImageWithShift`, `createGeneratedExercise`, `generateUniqueSlug`, `createGeneratedWOD` exist in Supabase client (and/or storage) modules; no hallucinated imports.
- **Auth:** All updated components use `supabase.auth.getSession()` and/or `onAuthStateChange`; no remaining `auth.currentUser` or Firebase `auth` in the changed code paths.
- **Security / env:** `import.meta.env.DEV` only used for dev logging in client components (Vite standard); no `fs`/`process` in client components; no `PUBLIC_` audit required for these changes.
- **Error handling:** Existing try/catch in save/upload flows retained; no dead or placeholder logic introduced.
- **Lint:** No new linter errors on modified files.

---

## Status

**READY TO MERGE**

No critical or security issues found. Stale Firestore references in comments/headers are corrected; behavior is consistent across save paths; auth and APIs are Supabase-only in the touched code.
