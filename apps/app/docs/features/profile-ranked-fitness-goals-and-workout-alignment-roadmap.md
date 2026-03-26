# Roadmap: Ranked fitness goals & workout alignment

**Spec:** [profile-ranked-fitness-goals-and-workout-alignment.md](./profile-ranked-fitness-goals-and-workout-alignment.md) (authoritative data model, scoring math, UX).

**Purpose:** Phases sized so each can become an **epic** (or milestone) in your planning tool; checklist items map to **tasks/stories**. Complete phases in order unless noted.

---

## Executive summary

| Phase | Epic title                | Focus                                                                                     | Depends on                                | Suggested milestone                |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| **0** | Data & profile ranking    | `fitness_goal_ranking`, types, AppContext, profile UI, trainer read-only display          | None                                      | Schema + user can rank 1–3 goals   |
| **1** | Snapshot + scorer + modal | `goal_snapshot`, `computeGoalAlignment`, all log writes, `WorkoutSummaryModal` “Goal fit” | Phase 0                                   | New logs show alignment bars       |
| **2** | Surfaces & distribution   | Analytics, CSV, week-row composite (memoized), analytics events                           | Phase 1                                   | Alignment visible in log + exports |
| **3** | Ecosystem & depth         | Onboarding ↔ id mapping, trainer aggregates, optional `fitness_goal_metadata`             | Phase 0 (partial), Phase 1 for aggregates | One vocabulary + optional metadata |

**Planning tool tips**

- Create one **epic** per phase; paste **Goal** + **Acceptance criteria** into the epic description.
- Each `- [ ]` line below ≈ one **issue**; sub-bullets can be subtasks or same ticket.
- Link issues to the spec file for engineers (hybrid snapshot, §3 decision table, §4.2 weights).

---

## Phase 0 — Data model & ranked profile

**Goal:** Persist ordered goal ranking on `profiles` and let users edit it; expose ranking to the client and Mission Control without computing workout alignment yet.

**Prerequisites:** None.

### Database & types

- [x] Add Supabase migration: `profiles.fitness_goal_ranking text[]` with `CHECK (cardinality(...) <= 3)` and element allowlist / distinctness per spec §3.1.
- [x] Default / backfill: existing rows — set `fitness_goal_ranking` from `primary_fitness_goal` where non-null (single-element array), else `{}` or `NULL` per product choice.
- [x] Regenerate or hand-update [`types/supabase.ts`](../../src/types/supabase.ts) for `profiles` row shape.
- [x] Extend [`UserProfile`](../../src/types.ts) + [`AppContext`](../../src/contexts/AppContext.tsx) profile load: `fitnessGoalRanking` (camelCase) from `fitness_goal_ranking`.

### Validation & server

- [x] Add shared allowlist module e.g. `lib/fitness-goal-taxonomy.ts` (ids, labels, max 3, uniqueness helpers) per spec §13.
- [x] Optional Astro action `updateProfileFitnessGoalRanking` in [`actions/index.ts`](../../src/actions/index.ts) with Zod (mirror `updateProfileHealthFilters`).

### Profile UI

- [x] Replace or augment primary goal `<select>` in [`ProfilePage.tsx`](../../src/components/react/ProfilePage.tsx) with ranked badge UX (§5): show rank 1/2/3, max three goals, optimistic save + partial revert on error (`persistHiitStyles` pattern).
- [x] On save: dual-write `primary_fitness_goal = ranking[0] ?? null` until deprecated (§3.1 legacy).
- [x] On read: if `fitness_goal_ranking` empty and `primary_fitness_goal` set, treat as one-element ranking in form parser.

### Trainer / admin read path

- [x] Extend [`mission-control-profile.ts`](../../src/lib/supabase/admin/mission-control-profile.ts) `select` + DTO with `fitness_goal_ranking`.
- [x] [`ClientDetailView.tsx`](../../src/components/react/trainer/views/ClientDetailView.tsx): display ranked goals with labels (badges or ordered list).

### Testing & docs

- [x] Unit tests for taxonomy helpers (toggle order, dedupe, cap at 3).
- [x] Manual: rank goals, refresh, Mission Control shows same order.

**Acceptance criteria**

- User can set 0–3 distinct canonical goal ids in priority order; order round-trips to DB.
- `primary_fitness_goal` stays compatible for legacy readers.
- Trainer client detail shows ranked goals when present.

**Explicitly out of scope for Phase 0**

- `goal_snapshot`, `computeGoalAlignment`, Training Log UI changes.

---

## Phase 1 — Workout `goal_snapshot`, scorer, modal

**Goal:** Every new/updated log stores intent via `goal_snapshot`; users see per-goal alignment (and optional composite) in the workout summary modal using pure TS scoring.

**Prerequisites:** Phase 0 complete (profile ranking available at save time).

### Database & types

- [x] Migration: `workout_logs.goal_snapshot text[]` nullable (spec §3.2).
- [x] Extend [`WorkoutLog`](../../src/types.ts) with `goalSnapshot?: string[] | null` (and snake_case mapping in client layer).

### Write path

- [x] Audit all inserts/updates to `workout_logs` (handoff, program completion, manual save — spec §7, §13); ensure `goal_snapshot` is set from current `fitness_goal_ranking` for the row owner.
- [x] Implement in [`workout-logs.ts`](../../src/lib/supabase/client/workout-logs.ts) (and siblings): pass `goal_snapshot` on save; extend fetches / training merge to `select` `goal_snapshot`.
- [x] Optional hardening: Postgres `BEFORE INSERT OR UPDATE` trigger to fill `goal_snapshot` from `profiles` when `NULL` (spec §7).

### Scoring library

- [x] New [`lib/fitness-goal-alignment.ts`](../../src/lib/fitness-goal-alignment.ts): `ALIGNMENT_SCORER_VERSION`, `computeGoalAlignment(log, goalSnapshot)` → `byGoalId`, `composite` per §4.2 (50/30/20 + renormalize for 1–2 goals).
- [x] v1 heuristic tables: start with 3–4 signals (type, format, duration, intensity/active rest) per §4.3; use existing `deriveWorkoutType` / `deriveWorkoutFormat` from [`training-log.ts`](../../src/lib/supabase/client/training-log.ts).
- [x] Golden tests + property tests per §4.4.

### UI

- [x] [`WorkoutSummaryModal.tsx`](../../src/components/react/training-log/WorkoutSummaryModal.tsx): “Goal fit” section — horizontal bars + `aria-*`, copy that scores are estimates (align with [`calculations-display-design.md`](./training-log/calculations-display-design.md)).
- [x] If `goal_snapshot` null: hide section or short legacy message (spec §6).

### Testing

- [x] E2E or manual: save workout with ranked profile → reopen modal → bars match golden expectation for a known fixture.

**Acceptance criteria**

- New logs persist `goal_snapshot` matching profile ranking at save time; `NULL` when user has no ranked goals.
- Modal shows 0–3 bars + composite from `computeGoalAlignment` only (no stored scores in DB).
- Changing scorer tables changes displayed numbers for existing logs without migration (documented behavior).

**Explicitly out of scope for Phase 1**

- Week grid composite, CSV, analytics aggregates, onboarding id merge.

---

## Phase 2 — Analytics, export, list density

**Goal:** Reuse the same pure scorer for summaries and exports; add lightweight composite in dense UI without jank.

**Prerequisites:** Phase 1 complete.

### Analytics tab / cards

- [x] Training Log analytics (or equivalent): one or more cards using **computed** composite over loaded logs (spec §8) — same function as modal, no duplicate math.
- [x] Optional: `@interval-timers/analytics` event when user views alignment or changes ranking (spec §10).

### CSV / export

- [x] Add `goal_snapshot` serialization (e.g. `longevity|fat_loss`) and optional **computed** composite column at export time (spec §8).

### Week grid / list row

- [x] Phase 2 UI: show composite only or tier icon per cell; `useMemo` / batch compute; avoid full vector per row for huge lists (spec §6, §14).

### Copy & trust

- [x] Short UI note that alignment estimates may update as the model improves (`ALIGNMENT_SCORER_VERSION` in support/changelog) per spec §12.

**Acceptance criteria**

- Analytics numbers match modal for the same log set and scorer version.
- Export columns match on-screen semantics.
- Scrolling a typical week does not cause noticeable frame drops (profile if needed).

---

## Phase 3 — Ecosystem vocabulary & trainer depth

**Goal:** Reduce drift between Plan Builder / onboarding strings and profile ids; optional richer profile metadata and trainer-facing insights.

**Prerequisites:** Phase 0 for profile; Phase 1 for alignment-based aggregates.

### Onboarding / Plan Builder

- [x] Map [`types/onboarding.ts`](../../src/types/onboarding.ts) `FitnessGoal` strings → canonical snake_case ids (or store both during transition) per spec §10, §12.

### Trainer / Mission Control

- [x] Optional: roster or client insights using average composite or time “aligned” with #1 goal (spec §9) — only after Phase 1 data exists.

### Optional schema

- [x] If product needs per-goal notes/dates: migration `fitness_goal_metadata jsonb` separate from `fitness_goal_ranking` (spec §3.1 evolution).

### AMRAP acquisition template (implemented in this chat)

- [x] AMRAP auth chrome updated to **Sign in** / **Sign up** in session, with-friends, and interval pages.
- [x] Guest save-gates wired for recap close, **View in History**, **View results**, and View Results modal close path.
- [x] `PostWorkoutRecapModal` and `ViewResultsModal` extended with dual CTA callbacks (`Sign in` + `Sign up`) and parent-driven guest intercepts.
- [x] `useSocialAmrap` finished strip aligned with same guest-gate behavior via shared intercept callbacks.
- [x] App minimal onboarding route added (`/account/onboarding/minimal`) with baseline + ranked fitness goals.
- [x] AMRAP auth redirect wired to minimal onboarding using `AuthModal returnUrl`, then back to account/HUD return target.
- [x] Analytics events added for acquisition funnel (`guest_save_prompt_shown`, `guest_save_prompt_signup`, `minimal_onboarding_complete`).
- [x] Cross-app rollout checklist document added (`amrap-guest-acquisition-template-checklist.md`).

**Acceptance criteria**

- Single source of truth documented for goal ids across onboarding and profile.
- Any new trainer metric uses shared `computeGoalAlignment` or documented aggregate, not one-off SQL.

---

## Future backlog (not phased — pull into planning when prioritized)

These are spec call-outs that do not block Phases 0–3.

- [ ] Modal toggle: “Evaluate with my **current** goals” vs snapshot-only (spec §12).
- [ ] Filters: “High composite” — in-memory first; generated column only if scale demands (spec §8).
- [ ] AI / program generator: bias templates from `fitnessGoalRanking` (spec §10).
- [ ] Audit-grade persisted scores + `ALIGNMENT_SCORER_VERSION` on row (spec §14 caveat) — additive to hybrid model.

---

## Traceability

| Roadmap phase | Spec sections                                          |
| ------------- | ------------------------------------------------------ |
| 0             | §3.1, §5, §9 (read), §13 (profile files)               |
| 1             | §3.2, §4, §6 (modal), §7, §13 (logs + modal + new lib) |
| 2             | §6 (list), §8, §10 (analytics package), §12 (copy)     |
| 3             | §9 (aggregates), §10 (onboarding), §3.1 metadata       |

---

_End of roadmap. Bump checklist items in your planning tool as work ships; keep the spec as the single source for formulas and column definitions._
