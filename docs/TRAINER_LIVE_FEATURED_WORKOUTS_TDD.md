# Technical Design: Featured Workouts for Trainer Live (AMRAP / Tabata Shells)

**Status:** Draft (initial design)  
**Scope:** Mission Control `/trainer/workouts` + live session “Choose workout” flows for **Video + Intervals** (`countdown_timer` shell)  
**Related UI:** `TrainerLiveAmrapWorkoutPickerModal`, `TrainerLiveTabataWorkoutPickerModal`, `@interval-timers/amrap-workout-picker`

---

## 1. Problem

Trainers configure and review workouts under `/trainer/workouts` (library, Workout Factory, predesigned content). When a **Video + Intervals** live session is running, they open **Start AMRAP** or **Start Tabata** and use the same chooser workflows (saved library → General AMRAP / levels / build, or Tabata saved list → rounds).

Today there is **no way to pin** workouts they intend to run **before** the session starts. They must navigate the full hierarchy each time, even for workouts they already decided on.

---

## 2. Goals

1. From **Mission Control workouts**, let a trainer **mark workouts as featured** for the **AMRAP** chooser and/or **Tabata** chooser (independently where applicable).
2. When **Choose AMRAP workout** or **Choose Tabata workout** opens during a live session, show **featured items first** (same card affordances as today), then the existing options (e.g. “My saved workouts”, General AMRAP, Beginner levels, etc.).
3. **Reuse** existing shell workflows: featured entries are **shortcuts into the same attach/preview flows**; no duplicate “attach” logic beyond ordering and visibility.
4. Trainers can feature **library workouts** they own; **design** should allow **system/predesigned** and **newly created** workouts once those rows exist in the library (see §5.3).

### 2.1 Product decisions (V1)

- **Featured vs. library (no deduplication):** A featured workout appears in the **Featured** block at the top of the live picker **and** remains in its **natural position** in **My saved workouts** (alphabetical or chronological per existing list ordering). Do **not** hide it from the main library — trainers may scroll to their usual spot; omission reads as deletion.
- **Scope:** **Global per trainer** only for V1. Session-specific featured templates are out of scope (relational complexity + pre-session staging UI). Global lists address the primary friction with minimal engineering surface.
- **Mobile Mission Control:** Same toggle semantics as desktop; expose controls via a **bottom-sheet drawer** and/or an **ellipsis (⋯) context menu** on the workout card to preserve horizontal space.

---

## 3. Non-goals (initial release)

- Changing client (`/trainer/live/join/...`) behavior.
- Auto-starting a workout when the session opens (featured is **selection convenience**, not autoplay).
- Cross-trainer sharing of featured lists.
- Admin-curated global “featured for all trainers” (could be a later phase).
- **Per-session** featured sets, staging templates, or pre-session “prepare featured” flows (V1 is **global per trainer** only; see §2.1).

---

## 4. Current architecture (reference)

| Area | Implementation |
|------|------------------|
| Live lobby | `TrainerLiveLobbyView` — shell `video_only` vs `countdown_timer` (Video + Intervals). |
| Host session | `TrainerLiveHostView` — **Start AMRAP** / **Start Tabata** open pickers. |
| AMRAP picker | `TrainerLiveAmrapWorkoutPickerModal` → fetches `GET /api/trainer/workouts`, filters `factoryMetabolicMode === 'amrap_density'`, passes `savedWorkouts` to `AmrapWorkoutPicker`. |
| Tabata picker | `TrainerLiveTabataWorkoutPickerModal` — same API, filters **Balanced Tabata** mode, list + confirm rounds. |
| Protocol step | `packages/amrap-workout-picker/src/AmrapWorkoutPicker.tsx` — **`protocol`** step renders “My saved workouts” (navigates to `saved` step), **General AMRAP**, level cards, etc. |

**Extension point:** Add a **Featured** block **above** the existing “My saved workouts” button on the `protocol` step (AMRAP). For Tabata, add a **Featured** section **above** the scrollable saved list in the modal.

---

## 5. Data model

### 5.1 Recommended: normalized join table

Store **ordered** featured workout references per trainer, scoped by **modal modality** so AMRAP and Tabata lists stay independent.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `trainer_user_id` | uuid | FK → `auth.users` / `profiles` (match existing trainer FK patterns) |
| `workout_id` | uuid | FK → `public.workouts` (or equivalent library table used by `/api/trainer/workouts`) |
| `context` | text | Enum: `'trainer_live_amrap'` \| `'trainer_live_tabata'` |
| `sort_order` | int | 1..N for stable ordering (1-based, aligned with SQL `WITH ORDINALITY` in `update_featured_workouts`) |
| `created_at` | timestamptz | |

**Constraints**

- Unique `(trainer_user_id, workout_id, context)` — same workout cannot be featured twice in the same modal.
- `sort_order` unique per `(trainer_user_id, context)` (or use `position` with reorder API).

**RLS:** Trainer can read/write **only their rows** (`trainer_user_id = auth.uid()`).

### 5.2 Alternatives (not preferred for v1)

- **JSON column on `profiles`** (e.g. `featured_live_workouts: { amrap: uuid[], tabata: uuid[] }`): faster to ship, weaker integrity and harder to query.
- **Boolean on `workouts`** (`featured_for_live_amrap`): only one bit per workout; no ordering, no separate Tabata list without extra columns.

### 5.3 System / predesigned / “not yet a row”

- **Library workouts** returned by `GET /api/trainer/workouts` already carry `id`, `title`, `blocks`, `factoryMetabolicMode`, etc. — **ideal for featuring** as `workout_id`.
- **Pure in-code presets** (e.g. `AMRAP_WORKOUT_LIBRARY` entries with no `workouts` row) are **not** represented as UUIDs. **MVP:** feature only rows that exist in the trainer library API. **Phase 2:** optional `featured_kind: 'library' | 'preset'` + `preset_key` if product requires featuring predesigned cards before they are saved.

---

## 6. API surface

### 6.1 Read (for pickers and workouts page)

- **Option A:** Extend `GET /api/trainer/workouts` with `featuredForLiveAmrap` / `featuredForLiveTabata` booleans and `featuredLiveSortOrder` (heavier payload).
- **Option B (cleaner):** New endpoints:
  - `GET /api/trainer/live/featured-workouts?context=amrap|tabata` → ordered `{ workoutId, sortOrder }[]` or hydrated workout summaries.
  - `PUT /api/trainer/live/featured-workouts` — body: ordered `{ workoutIds: string[] }` per context (replace-all semantics for v1).

### 6.2 Validation

- Each `workout_id` must belong to the trainer and **match metabolic mode** for the context:
  - `trainer_live_amrap` → Density AMRAP (same filter as `TrainerLiveAmrapWorkoutPickerModal`).
  - `trainer_live_tabata` → Balanced Tabata (same filter as Tabata modal).
- Reject or strip invalid IDs on write with clear 400 messages.

---

## 7. UI/UX specification

### 7.1 `/trainer/workouts` (and workout detail where appropriate)

**Desktop / tablet**

- Per workout row (or detail drawer): **“Feature in Live”** with sub-toggle or chips: **AMRAP** / **Tabata** (only enable Tabata if mode is Balanced Tabata, etc.).
- **Optional:** drag-to-reorder featured order within a small “Live featured” panel (same page sidebar).
- **Empty state:** Explain that featured workouts appear at the top of **Choose AMRAP / Tabata** during Video + Intervals sessions.

**Mobile (Mission Control)**

- **Same business rules** as desktop (which modalities can be toggled, validation, ordering).
- **Presentation:** Surface **Feature in Live** inside a **bottom-sheet drawer** opened from the card, and/or via an **ellipsis (⋯) context menu** on the workout card — avoids crowding narrow layouts while keeping parity.

### 7.2 `TrainerLiveAmrapWorkoutPickerModal` + `AmrapWorkoutPicker`

- Fetch featured list when modal opens (or receive from parent cache).
- Pass into picker as e.g. `featuredSavedWorkouts={...}` (same shape as `AmrapSavedWorkoutItem[]`).
- **Protocol step:** Render **“Featured for Live”** (or similar) block **above** the existing “My saved workouts” entry; each card uses **existing** styles (reuse the saved-card pattern from the `saved` step).
- **Tap behavior:** Same as choosing from saved — go to **duration confirm** (or straight to attach if product wants one-tap; default = **same as saved**).
- **No deduplication:** If a workout is featured, it still appears in the **`saved` step list** in its normal sort order alongside all other saved workouts (see §2.1). The Featured block is an additional shortcut, not a replacement row.

### 7.3 `TrainerLiveTabataWorkoutPickerModal`

- **Featured** horizontal or vertical stack **above** current list of saved Tabata workouts.
- **No deduplication:** Featured Tabata workouts **also** remain in the main saved list below (same rationale as AMRAP).
- Confirm **round count** step unchanged.

### 7.4 Limits

- Cap featured count per context (e.g. **5–10**) to avoid scrolling the modal.

---

## 8. State & caching

- **Mission Control:** Optimistic UI on toggle; sync via PUT.
- **Live session:** On modal open, **GET featured + library** (or merge in client). Featured list should be **small**; tolerate stale data until next open (no realtime requirement for v1).

---

## 9. Analytics (recommended)

- `trainer_live_featured_workout_selected` — properties: `context`, `workout_id`, `source: featured|library_path`.
- `trainer_live_featured_workout_configured` — when user toggles feature on `/trainer/workouts`.

---

## 10. Testing

- **Unit:** Filter logic — only AMRAP-density workouts in AMRAP context; Tabata in Tabata context.
- **API:** RLS — trainer B cannot read/write trainer A’s featured rows.
- **E2E (smoke):** Set featured → start Video + Intervals session → **Start AMRAP** → featured card appears above “My saved workouts” → open **My saved workouts** → same workout still visible in list order → completes attach flow from either entry point.

---

## 11. Rollout

1. Ship migration + RLS + read/write API behind feature flag if needed.
2. Ship `/trainer/workouts` toggles.
3. Ship picker UI (AMRAP then Tabata, or both in one release if low risk).

---

## 12. Resolved architecture (reference)

| Topic | Decision |
|-------|-----------|
| Featured vs. **My saved workouts** | **Do not deduplicate.** Featured block + full library list; workout may appear in both places. |
| Scope | **Global per trainer** for V1 only; no per-session / staging templates in this phase. |
| Mobile `/trainer/workouts` | Same toggles; **bottom sheet** and/or **⋯ menu** on the card. |

---

## 13. File touchpoints (expected)

| Layer | Files / packages |
|-------|------------------|
| DB | New migration under `supabase/migrations/` |
| API | `apps/app/src/pages/api/trainer/...` (new or extend existing) |
| Workouts UI | Trainer workouts list / detail views under `apps/app/src/components/react/trainer/` |
| Live modals | `TrainerLiveAmrapWorkoutPickerModal.tsx`, `TrainerLiveTabataWorkoutPickerModal.tsx` |
| Shared picker | `packages/amrap-workout-picker/src/AmrapWorkoutPicker.tsx` — new props + protocol section |

---

*Document version: 0.2 — adds resolved product decisions (no dedupe, global V1 scope, mobile patterns).*
