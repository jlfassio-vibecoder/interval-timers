# WOD Engine: AI Exercise Generation Workflow (Audit)

This document audits the **AI Exercise Generation** flow in the WOD Engine so the same pattern can be implemented elsewhere (e.g. Workout Editor, Challenge Editor, standalone exercise generator).

---

## 1. Overview

**Where it lives:** Admin → WOD Engine. After a WOD is generated and saved, the user can open a **saved WOD**, then for each exercise name in the workout (warmup/main/finisher/cooldown) use **"Generate with Visualization Lab"** (Sparkles icon). That opens a modal that:

1. Lets the user adjust topic, complexity, style, demographics, etc.
2. Calls an API to **research** the exercise (Gemini + Google Search) and **generate an infographic image** (Gemini image model).
3. On **Save**, uploads the image to Firebase Storage, creates a `generated_exercises` document, and passes back an `Exercise` object to the parent so the WOD’s `exerciseOverrides` can be updated.

**Outcome:** The WOD gets a per-exercise override (image + instructions) and a new row in Admin → Generated Exercises (pending approval).

---

## 2. Entry Points and UI

| Location                                                        | Trigger                                                                                               | Result                                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [WODEngine.tsx](src/components/react/admin/views/WODEngine.tsx) | User selects a **saved WOD** → clicks **Sparkles** next to an exercise name in the workout blocks     | `handleOpenLab(exerciseName)` → `setLabExercise(exerciseName)` → modal opens |
| Modal                                                           | `ExerciseVisualizationLabModal` with `exerciseName={labExercise}`, `onSave={handleSaveExerciseToWOD}` | User submits form → API call → optional Save to WOD                          |

**State in WODEngine:**

- `labExercise: string | null` — exercise name for the modal (when set, modal is open).
- `handleOpenLab(name)` sets it, `handleCloseLab()` clears it.
- `handleSaveExerciseToWOD(exercise: Exercise)` is called by the modal after a successful save; it calls `updateExerciseOverride(selectedSavedWOD.id, labExercise, exercise)` and updates local WOD state and list, then closes the lab (`setLabExercise(null)`).

---

## 3. Modal Component: ExerciseVisualizationLabModal

**File:** [ExerciseVisualizationLabModal.tsx](src/components/react/admin/ExerciseVisualizationLabModal.tsx)

**Props:**

- `isOpen: boolean`
- `onClose: () => void`
- `exerciseName: string` — pre-filled exercise topic (e.g. the WOD exercise name).
- `onSave: (exercise: Exercise) => void` — called with the built `Exercise` after creating the generated_exercise doc and uploading the image.

**Internal state (simplified):**

- Form: `exerciseTopic`, `complexityLevel`, `visualStyle`, `demographics`, `movementPhase`, `bodySide`, optional `referenceImageUrl` / `referenceImageData` (for subject consistency).
- `result: BiomechanicalPoints | null` — API response (image data URL, biomechanical points, search results, imagePrompt).
- `loading`, `error`, `saving`, `saveError`, `savedImageUrl`.

**Flow inside the modal:**

1. User fills form and clicks **Generate** → `handleSubmit`:
   - `POST /api/generate-exercise-image` with body below.
   - On success: `setResult(data)` (image + biomechanicalPoints + searchResults + imagePrompt).
2. User clicks **Save to WOD** → `handleSaveToWOD`:
   - Generate unique slug (`generateSlug(exerciseTopic)` → `generateUniqueSlug(baseSlug)`).
   - Upload image blob to Firebase Storage: `generated-exercises/{uid}/{uniqueSlug}-{timestamp}.png`.
   - Get download URL.
   - Parse biomechanics: `parseBiomechanicalPoints(result.biomechanicalPoints)` → `{ biomechanics, kineticChainType }`.
   - Transform search results: `transformSearchResultsToSources(result.searchResults, exerciseTopic)` → `sources`.
   - Create document: `createGeneratedExercise({ slug, exerciseName, imageUrl, storagePath, kineticChainType, biomechanics, imagePrompt, complexityLevel, visualStyle, sources, status: 'pending', generatedBy, generatedAt })`.
   - Build `Exercise` for parent: `{ name, images: [downloadUrl], instructions: biomechanics.performanceCues }`.
   - Call `onSave(exercise)`.

---

## 4. API: generate-exercise-image

**File:** [pages/api/generate-exercise-image.ts](src/pages/api/generate-exercise-image.ts)

**Method:** `POST`

**Request body:**

```ts
{
  exerciseTopic: string;           // required
  complexityLevel?: string;        // default 'intermediate'
  visualStyle?: string;            // default 'photorealistic'
  demographics?: string;
  movementPhase?: string;
  bodySide?: string;
  referenceImage?: string;        // optional base64 data URL for subject consistency
}
```

**Response (200):**

```ts
{
  image: string;                   // data URL of generated image
  biomechanicalPoints: string[];  // 5-point array from research
  searchResults?: Array<{ web?: { uri?, title? }, uri?, url?, title? }>;
  imagePrompt?: string;
}
```

**Error:** `{ error: string }` with 400 (validation), 500 (research/image failure), 503 (production without GEMINI_API_KEY).

**Server flow:**

1. **Stage 1 – Research:** `researchTopicForPrompt(exerciseTopic, complexityLevel, visualStyle, demographics, movementPhase, bodySide)` in [gemini-server.ts](src/lib/gemini-server.ts). Uses Gemini with Google Search; returns `{ biomechanicalPoints, imagePrompt, searchResults }`.
2. **Stage 2 – Image:** `generateInfographicImage(researchResult.imagePrompt, referenceImage)` — Gemini image generation, optionally with reference image for subject consistency.

---

## 5. Server-Side Helpers (Gemini)

**File:** [lib/gemini-server.ts](src/lib/gemini-server.ts)

- **researchTopicForPrompt(...)**
  - Model: `gemini-3-pro-preview` with `tools: [{ googleSearch: {} }]`.
  - Returns structured JSON: `biomechanicalPoints` (5 strings), `imagePrompt`, and grounding chunks as `searchResults`.

- **generateInfographicImage(imagePrompt, referenceImageBase64?)**
  - Generates infographic image; if `referenceImageBase64` is provided, uses it so the subject (person) stays consistent.

**Env:** `GEMINI_API_KEY` required in production (API returns 503 if missing).

---

## 6. Client-Side Services

### 6.1 Generated exercises (Firestore)

**File:** [lib/firebase/client/generated-exercises.ts](src/lib/firebase/client/generated-exercises.ts)

- **createGeneratedExercise(input)**
  - Adds a document to `generated_exercises` with `createdAt`/`updatedAt`.
  - Input shape: slug, exerciseName, imageUrl, storagePath, kineticChainType, biomechanics (ParsedBiomechanics), imagePrompt, complexityLevel, visualStyle, sources, status, generatedBy, generatedAt.
  - Returns new document ID.

- **generateUniqueSlug(baseSlug, excludeDocumentId?)**
  - Returns a slug unique in the collection (appends `-1`, `-2`, … if needed). Use `excludeDocumentId` when updating an existing doc.

### 6.2 Generated WODs (Firestore)

**File:** [lib/firebase/client/generated-wods.ts](src/lib/firebase/client/generated-wods.ts)

- **updateExerciseOverride(wodId, exerciseName, exercise)**
  - Updates the WOD document: `exerciseOverrides.{exerciseName} = exercise` and `updatedAt`.
  - `Exercise` is `{ name: string, images: string[], instructions: string[] }` ([types.ts](src/types.ts)).

### 6.3 Storage

- Image upload: Firebase Storage via `ref(storage, path)`, `uploadBytes`, `getDownloadURL`.
- Path pattern: `generated-exercises/{uid}/{uniqueSlug}-{Date.now()}.png`.

---

## 7. Parsing and Types

**File:** [lib/parse-biomechanics.ts](src/lib/parse-biomechanics.ts)

- **parseBiomechanicalPoints(points: string[])**
  - Maps the 5-point research array to structured `ParsedBiomechanics` (biomechanicalChain, pivotPoints, stabilizationNeeds, commonMistakes, performanceCues) and `kineticChainType`.
  - Used when creating the `generated_exercises` document and when building `Exercise.instructions` (performance cues only for WOD override).

- **transformSearchResultsToSources(searchResults, exerciseName)**
  - Converts API/search chunks to `ExerciseSource[]` for the generated exercise (source verification).

- **generateSlug(exerciseName)**
  - URL-safe slug from display name (used as base for `generateUniqueSlug`).

---

## 8. Data Shapes

### Exercise (for WOD override and onSave)

```ts
// src/types.ts
interface Exercise {
  name: string;
  images: string[];
  instructions: string[]; // e.g. performance cues only
  videoUrl?: string;
}
```

### GeneratedExercise (Firestore)

See [types/generated-exercise.ts](src/types/generated-exercise.ts): slug, exerciseName, imageUrl, storagePath, kineticChainType, biomechanics, imagePrompt, complexityLevel, visualStyle, sources, status, generatedBy, generatedAt, etc.

### WOD exerciseOverrides

On `GeneratedWODDoc`: `exerciseOverrides?: Record<string, Exercise>`. Key = exercise name as it appears in the workout (e.g. "Push-up"); value = override with image and instructions.

---

## 9. Implementing This Workflow Elsewhere

To reuse the same “generate exercise” flow in another context (e.g. Workout Editor, Challenge Editor, or a standalone page):

1. **Reuse the modal**
   - Render `ExerciseVisualizationLabModal` with:
     - `exerciseName`: initial topic (e.g. current exercise name or empty).
     - `onSave`: callback that receives `Exercise` and then:
       - Either update a parent entity (e.g. workout exercise, challenge exercise) with that `Exercise` (name, images, instructions), or
       - Just navigate/open the new generated exercise in Admin; no need to update a WOD.

2. **Or reuse only the API**
   - Call `POST /api/generate-exercise-image` with the same body.
   - Then:
     - Upload image to Storage (same path pattern if you want it under `generated-exercises`).
     - Call `createGeneratedExercise(...)` with parsed biomechanics and sources.
     - If the parent is a WOD, call `updateExerciseOverride(wodId, exerciseName, exercise)`.
     - If the parent is a workout/challenge, implement the equivalent of `updateExerciseOverride` for that entity (e.g. update one exercise slot with `{ name, images, instructions }`).

3. **Dependencies to have in place**
   - Firebase: Auth (for `user.uid`), Firestore (`generated_exercises`), Storage.
   - Env: `GEMINI_API_KEY` for the API.
   - Client: `createGeneratedExercise`, `generateUniqueSlug` from `generated-exercises`; Storage ref/uploadBytes/getDownloadURL; `parseBiomechanicalPoints`, `transformSearchResultsToSources`, `generateSlug` from `parse-biomechanics`.

4. **Optional: reference image**
   - If you support a “reference image” for subject consistency, pass it as `referenceImage` (base64 data URL) in the API request; the modal already supports loading a URL via `/api/load-reference-image` and sending the base64 to the API.

---

## 10. Summary Diagram

```
[WOD Engine: Saved WOD]
       │
       │ User clicks Sparkles on exercise "Push-up"
       ▼
[ExerciseVisualizationLabModal]
  exerciseName="Push-up", onSave=handleSaveExerciseToWOD
       │
       │ User clicks Generate
       ▼
POST /api/generate-exercise-image
  body: { exerciseTopic, complexityLevel, visualStyle, ... }
       │
       ├─► researchTopicForPrompt() → biomechanicalPoints, imagePrompt, searchResults
       └─► generateInfographicImage(imagePrompt, referenceImage?) → image data URL
       │
       ◄── { image, biomechanicalPoints, searchResults, imagePrompt }
       │
       │ User clicks "Save to WOD"
       ▼
generateUniqueSlug(baseSlug)
upload image → Storage → downloadUrl
parseBiomechanicalPoints(result.biomechanicalPoints)
transformSearchResultsToSources(result.searchResults, topic)
createGeneratedExercise({ slug, exerciseName, imageUrl, biomechanics, sources, status: 'pending', ... })
build Exercise = { name, images: [url], instructions: performanceCues }
onSave(exercise)
       │
       ▼
[WODEngine] handleSaveExerciseToWOD(exercise)
  updateExerciseOverride(selectedSavedWOD.id, labExercise, exercise)
  Update local selectedSavedWOD & savedWODs with exerciseOverrides[labExercise] = exercise
  setLabExercise(null)  // close modal
```

This audit should be enough to replicate the AI exercise generation workflow in other parts of the app.
