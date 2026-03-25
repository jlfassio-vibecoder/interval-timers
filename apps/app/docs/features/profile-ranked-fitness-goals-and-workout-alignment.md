# Ranked fitness goals & per-workout goal alignment

Design outline for replacing single **Primary fitness goal** with a **ranked multi-select** (up to three goals, order = priority) and computing **how each saved workout aligns** with those goals, surfaced as **horizontal percentage bars** in the Training Log ecosystem.

---

## 1. Current state (codebase)

| Area | Today |
|------|--------|
| **Profile** | `profiles.primary_fitness_goal` (`text`, single value). UI: `<select>` with `FITNESS_GOALS` in [`ProfilePage.tsx`](../../src/components/react/ProfilePage.tsx): `fat_loss`, `cardiovascular_endurance`, `muscle_hypertrophy`, `longevity`. |
| **Onboarding / Plan builder** | Separate vocabulary: human-readable `FitnessGoal[]` in [`types/onboarding.ts`](../../src/types/onboarding.ts) (`'Lose fat'`, `'Build muscle'`, …). Not the same ids as the profile column. |
| **Workout logs** | `workout_logs` has enrichment: `workout_type`, `workout_format`, `intensity`, `focus_area`, `is_active_rest`, plus `source`, `duration_seconds`, etc. ([`00067` handoff](../../supabase/migrations/00067_workout_logs_handoff.sql), [enrichment migration](../../../../supabase/migrations/20250327000000_workout_logs_training_log_enrichment.sql)). |
| **Derivations** | [`training-log.ts`](../../src/lib/supabase/client/training-log.ts): `deriveWorkoutType`, `deriveWorkoutFormat` from `source` when columns null. |
| **Training Log UI** | [`WorkoutSummaryModal`](../../src/components/react/training-log/WorkoutSummaryModal.tsx), week grid, filters ([`training-log-filters.ts`](../../src/lib/training-log-filters.ts)). MET/calorie transparency is documented in [`calculations-display-design.md`](./training-log/calculations-display-design.md). |
| **Consumers of profile goal** | Mission Control DTO + [`ClientDetailView`](../../src/components/react/trainer/views/ClientDetailView.tsx), analytics copy (if any). No central “goal fit” engine exists yet. |

**Implication:** Any scoring layer should use **one canonical goal id set** (recommend: keep profile snake_case ids as source of truth) and optionally map onboarding strings later.

---

## 2. Product goals

1. **Profile:** User ranks 1–3 goals (not all three required). Badges show rank **1 / 2 / 3** clearly.
2. **Persistence:** Store **ordered** goals with stable semantics for API, analytics, and trainers.
3. **Per workout:** Each **saved** log carries a **`goal_snapshot`** of ranked goals at save time; alignment vs those goals is **computed deterministically** (same log + snapshot + scorer version → same bars), shown as **per-goal horizontal bars** (percent match).
4. **Ecosystem:** Same definitions and scoring helpers in the main app first; other surfaces (trainer view, exports, future program generator) consume the same types.

**Non-goals (initial phase):** Medical claims, replacing MET math, or perfect exercise-compendium physics. Alignment is a **transparent heuristic** with a **versioned scorer in code** (see §4).

---

## 3. Data model (decided)

| Approach | What you store | What you compute at read time | Trade-off (one line) |
|----------|----------------|-------------------------------|----------------------|
| **Frozen** | Full alignment (e.g. per-goal % + composite) at save time | Nothing (display stored numbers) | History matches “old math” forever; heuristic improvements need backfill or mixed eras. |
| **Dynamic** | Only workout + enrichment | Re-score against **current** profile goals every view | Past logs “change meaning” when goals change; great for “what supports me *now*?” |
| **Hybrid (chosen)** | **`goal_snapshot text[]`** (ranked goals at log time) | Per-goal % + composite from **snapshot** + current scorer code | Preserves **intent**; improving tables updates all history **without** DB migrations. Optional later: “evaluate with current goals” toggle. |

**Skim summary:** Profile rank = ordered `text[]`. Log row = snapshot of that rank when saved. Scores = pure TypeScript, versioned in code (`ALIGNMENT_SCORER_VERSION`), not persisted in v1.

### 3.1 Profiles — ordered `text[]` (not `jsonb` for ranking)

**Decision:** `fitness_goal_ranking text[]` on `profiles`.

| Aspect | Rationale |
|--------|-----------|
| **Semantics** | Index `0` = rank **1**, index `1` = rank **2**, index `2` = rank **3**. Max cardinality **3**; empty array = no ranked goals. |
| **Constraints** | Postgres `CHECK (cardinality(fitness_goal_ranking) <= 3)`; optional `CHECK` that every element ∈ allowlist (`fat_loss`, `cardiovascular_endurance`, `muscle_hypertrophy`, `longevity`) and all distinct. |
| **Why not `jsonb` for rank** | Rank is the only property that matters for v1 alignment. `text[]` is tidy, fast, and trivial to validate in Zod / TypeScript. |
| **Evolution** | If we later need per-goal metadata (target date, motivation note, confidence), add a **separate** `fitness_goal_metadata jsonb` (or similar). **Do not** overload the ranking column—keep the hierarchy clean. |

**Legacy:** Keep `primary_fitness_goal` for compatibility during rollout: on read, if `fitness_goal_ranking` is empty and `primary_fitness_goal` is set, treat as a one-element ranking; on save, dual-write `primary_fitness_goal = ranking[0] ?? null` until deprecated.

**Validation:** Shared Zod + optional Astro action `updateProfileFitnessGoalRanking` (mirror `updateProfileHealthFilters`): max length 3, unique ids, allowlist only.

### 3.2 Workout logs — hybrid snapshot (**intent frozen**, **math dynamic**)

**Product decision:** Preserve **what the user was optimizing for at log time**, but **recompute fit percentages** whenever the UI renders, so heuristic improvements apply to history without DB backfills.

| Column | Type | Purpose |
|--------|------|---------|
| `goal_snapshot` | `text[]` nullable | Copy of `profiles.fitness_goal_ranking` (0–3 ids) **at insert/update time**. If the user had no goals, `NULL`. |

**Do not persist** per-goal 0–100 scores or a composite in the database for v1.

**At save time (client or server):**

1. Read current `fitness_goal_ranking` for `user_id`.
2. Write `goal_snapshot` on the row (same order as profile).
3. Enrichment fields (`workout_type`, `workout_format`, `source`, …) stay as today.

**At read / render time:**

1. If `goal_snapshot` is null → hide alignment UI (or show “No goals on file for this session” for legacy rows).
2. Else call `computeGoalAlignment(log, goal_snapshot)` → `by_goal_id` scores 0–100 and composite (§4.2).

**Optional (code-only):** Export a constant `ALIGNMENT_SCORER_VERSION` from `fitness-goal-alignment.ts` for analytics events or support (“which formula shipped”), not required as a DB column for v1.

**Legacy backfill:** For old logs without `goal_snapshot`, options: (a) leave null; (b) one-off backfill from **current** profile (distorts intent—avoid); (c) infer empty snapshot. Prefer (a) until we have a safe heuristic.

---

## 4. Scoring layer (logic)

**Location:** New module e.g. `apps/app/src/lib/fitness-goal-alignment.ts` (pure functions, unit-testable).

### 4.1 Inputs

- **Goals (ranking at evaluation time):** For historical logs, pass **`goal_snapshot: string[]`** (0–3 ids) read from the row—**not** the user’s current `fitness_goal_ranking`. For hypothetical “evaluate with my **current** goals” (future toggle), pass current profile ranking instead.
- **Workout:** `WorkoutLog` + `deriveWorkoutType` / `deriveWorkoutFormat`, `durationSeconds`, `intensity`, `focusArea`, `isActiveRest`, `effort`, `source`, optional future `workout_log_exercises` rows.

### 4.2 Output & rank-weighted composite

**Per-goal scores:** For each id in **`goal_snapshot`** (not current profile), return a score **0–100** keyed by goal id. Keys outside the snapshot are not required on the object.

**Headline “Alignment” score (decided):** Rank-weighted composite so a great match on priority #3 cannot beat a moderate match on priority #1:

\[
\text{Composite} = (s_1 \times 0.50) + (s_2 \times 0.30) + (s_3 \times 0.20)
\]

where \(s_i\) is the 0–100 fit for the goal at rank \(i\) in `goal_snapshot`.

**Fewer than three goals:** Renormalize weights so they sum to `1.0`:

| Goals in snapshot | Weights |
|-------------------|---------|
| 1 | \(1.0\) on \(s_1\) |
| 2 | \(0.625\) / \(0.375\) (same 5:3 ratio as 50%:30%) |
| 3 | \(0.50\) / \(0.30\) / \(0.20\) |

**UI:** Show **three horizontal bars** when three snapshot goals exist; fewer bars when snapshot shorter. Optionally show one **composite** line or ring for list cells (phase 2).

**Versioning:** Changing heuristic tables changes displayed numbers for **all** logs with a snapshot—by design. Document changes in changelog / `ALIGNMENT_SCORER_VERSION` bump; optional golden tests per version.

### 4.3 Heuristic tables (v1)

Maintain explicit **mapping tables** in code (documented, easy to tune):

- **By `workout_type`** (from column or `deriveWorkoutType`): e.g. Conditioning + HIIT formats → higher `cardiovascular_endurance` and `fat_loss`; Mobility → lower hypertrophy, etc.
- **By `workout_format`:** Tabata/EMOM/AMRAP → metabolic / cardio tilt; Steady State → endurance/longevity.
- **By duration buckets:** very short vs 30–45 vs 60+ min → different emphasis (e.g. longevity favors sustainable volume).
- **By `intensity` / `effort`:** coarsely bump “hard” sessions toward goals that assume intensity (within caps).
- **Active rest:** cap all scores or single dedicated rule.

Start **simple** (3–4 signals); bump `ALIGNMENT_SCORER_VERSION` when tables change.

### 4.4 Testing

- Golden fixtures: synthetic `WorkoutLog` + `goal_snapshot` → expected `by_goal_id` and composite per scorer version.
- Property: scores in `[0,100]`; empty snapshot → skip alignment; composite in `[0,100]`.

---

## 5. Profile UX

**Component pattern:** Reuse badge language from **Preferred HIIT styles** / **Physical considerations** ([`ProfilePage.tsx`](../../src/components/react/ProfilePage.tsx)).

**Interactions (pick one and stick to it):**

1. **Ordered queue:** Tap goal to append (max 3). Tap again to remove, or “Demote” control. Show **1 / 2 / 3** on badge.
2. **Explicit slots:** Three slots “Priority 1…3”; tap empty slot then goal to fill; clear slot button.

**Copy:** Clarify ranking affects how workouts are **interpreted**, not medical advice.

**Save path:** Dedicated `persistFitnessGoalRanking` (optimistic + partial revert on error, same pattern as `persistHiitStyles` / health filters) or validated action.

**AppContext / `UserProfile`:** Add `fitnessGoalRanking?: string[] | null` when loading profile so HUD / modals can read without extra fetch.

---

## 6. Training Log & workout detail UX

| Surface | Behavior |
|---------|----------|
| **Workout summary modal** | New section: “Goal fit” — compute `computeGoalAlignment(workout, workout.goalSnapshot)`; up to **three** bars + optional composite line. If `goal_snapshot` null, hide or legacy message. |
| **Week grid / list row** | Phase 2: show **composite only** (cheap: one number per log) or icon tier; avoid recomputing full vectors for hundreds of rows without `useMemo` / virtualization. |
| **Log editor / save** | On insert/update, set **`goal_snapshot`** from current profile ranking (not the score). All handoff paths ([`workout-logs.ts`](../../src/lib/supabase/client/workout-logs.ts), program completion, etc.) should pass snapshot consistently. |
| **Profile has no goals** | Save `goal_snapshot = NULL`; no alignment block in UI. |

**Accessibility:** Bars need `aria-valuenow` / labels; don’t rely on color alone (match [`calculations-display-design.md`](./training-log/calculations-display-design.md) guardrails).

---

## 7. Write path & backfill

1. **New / updated logs:** Extend [`saveWorkoutLog`](../../src/lib/supabase/client/workout-logs.ts) (and every code path that inserts into `workout_logs`) to include `goal_snapshot` populated from the authenticated user’s `fitness_goal_ranking` at save time.

   **Trigger option:** `BEFORE INSERT OR UPDATE` trigger on `workout_logs` that sets `goal_snapshot` from `profiles.fitness_goal_ranking` when `NEW.goal_snapshot IS NULL` ensures **one source of truth** and prevents client omission. Scoring still lives only in TypeScript.

2. **Tampering:** Snapshot describes user intent, not a financial audit. If integrity matters later, enforce snapshot via trigger and disallow client overrides.

3. **Legacy logs:** No score backfill required. Optional: populate `goal_snapshot` only when we can do so without lying about intent (generally **don’t** backfill from *current* profile).

---

## 8. Analytics & exports

- **Training log analytics:** Aggregate using **computed** composite (and/or time-in-band) over in-memory log lists—same pattern as MET helpers in [`calculations-display-design.md`](./training-log/calculations-display-design.md): one pure function, reused modal ↔ analytics.
- **CSV export:** Serialize `goal_snapshot` (e.g. `longevity|fat_loss`) and optionally **computed** composite at export time for consistency with on-screen math.
- **Filters (future):** “High composite” can filter in memory or materialize a generated column later if needed—**not** required for v1.

---

## 9. Mission Control & trainers

- Extend [`mission-control-profile.ts`](../../src/lib/supabase/admin/mission-control-profile.ts) + [`ClientDetailView`](../../src/components/react/trainer/views/ClientDetailView.tsx): show ranked list with 1–3 badges.
- Roster insights (later): average alignment per client.

---

## 10. Cross-app ecosystem

| App / package | Action |
|---------------|--------|
| **`apps/app`** | Profile, Training Log, types, Supabase client, scoring lib, migrations. |
| **`@interval-timers/analytics`** | New event props if tracking goal changes / alignment views. |
| **Workout Plan Builder / onboarding** | Map `FitnessGoal` strings → canonical ids or store both during transition. |
| **Timer / AMRAP handoff** | No change required if alignment is computed at log save from enrichment + `source`. |
| **AI workout generation** | Optionally read `fitnessGoalRanking` to bias `HiitOptions.primaryGoal` or block templates — later phase. |
| **bio-sync-sixty / landing** | Out of scope unless they start reading Supabase profile. |

---

## 11. Phasing

**Implementation roadmap (planning-tool checklists, acceptance criteria, dependencies):** [profile-ranked-fitness-goals-and-workout-alignment-roadmap.md](./profile-ranked-fitness-goals-and-workout-alignment-roadmap.md).

Summary:

1. **P0:** Migration (`fitness_goal_ranking`, `goal_snapshot`) + profile ranked UI + types + ClientDetailView + `UserProfile` field.  
2. **P1:** `computeGoalAlignment` + wire `goal_snapshot` on all log writes (or trigger) + modal bars + `WorkoutLog.goalSnapshot`.  
3. **P2:** Analytics card, CSV columns, list-cell composite (memoized).  
4. **P3:** Onboarding id unification, trainer aggregates, optional `fitness_goal_metadata`.

---

## 12. Risks & residual questions

- **Vocabulary drift:** Profile ids vs Plan Builder strings — explicit mapping or migrate onboarding to ids.  
- **Heuristic changes:** Scores “move” under users’ feet for old work—mitigate with transparent copy (“Estimates updated periodically”) and `ALIGNMENT_SCORER_VERSION` in support docs.  
- **Snapshot vs current profile:** Deliberately **not** recomputing against current goals for historical rows preserves **intent**; users who want “what if my *new* goals?” could be a separate **toggle** in the modal (“Evaluate with my current goals”) as a later enhancement.  
- **Performance:** Pure TS alignment over a **typical week’s** log count is negligible; for analytics over thousands of rows, batch in a worker or pre-aggregate—see §14.

---

## 13. File checklist (implementation touchpoints)

- `supabase/migrations/*_fitness_goal_ranking.sql`, `*_workout_logs_goal_snapshot.sql` (not `goal_alignment` jsonb)
- [`ProfilePage.tsx`](../../src/components/react/ProfilePage.tsx), [`types/supabase.ts`](../../src/types/supabase.ts), [`types.ts`](../../src/types.ts) (`UserProfile`, `WorkoutLog` + `goalSnapshot?: string[] | null`)
- [`workout-logs.ts`](../../src/lib/supabase/client/workout-logs.ts) and all insert paths: `goal_snapshot`
- [`fetchWorkoutLogsForTraining`](../../src/lib/supabase/client/workout-logs.ts) / training merge: select `goal_snapshot`
- [`actions/index.ts`](../../src/actions/index.ts) optional Zod action for profile ranking
- [`AppContext.tsx`](../../src/contexts/AppContext.tsx) profile load
- [`ClientDetailView.tsx`](../../src/components/react/trainer/views/ClientDetailView.tsx), [`mission-control-profile.ts`](../../src/lib/supabase/admin/mission-control-profile.ts)
- [`WorkoutSummaryModal.tsx`](../../src/components/react/training-log/WorkoutSummaryModal.tsx) + shared bar component
- New: `lib/fitness-goal-alignment.ts`, `lib/fitness-goal-taxonomy.ts` (ids, labels, rank helpers, composite weights)

---

## 14. Effectiveness: is this the right architecture for “Alignment Score”?

**Verdict: yes—for this codebase and the stated “Brain / journey” goals.** Here is how the chosen stack behaves against alternatives.

| Criterion | Hybrid snapshot + dynamic math | Persisted 0–100 jsonb (previous draft) |
|-----------|-------------------------------|----------------------------------------|
| **User story (“what was I chasing then?”)** | Strong: `goal_snapshot` is explicit behavioral intent. | Weaker unless jsonb also stored snapshot (duplication). |
| **Improving the heuristic without migrations** | Strong: change TS tables, all views update. | Weak: old rows stay on v1 math unless backfill. |
| **Honesty / transparency** | Good: one scorer in [`fitness-goal-alignment.ts`](../../src/lib/fitness-goal-alignment.ts); modal and analytics call the same function—aligned with MET single-helper pattern in [`calculations-display-design.md`](./training-log/calculations-display-design.md). | Risk of drift if export, modal, and server use different code paths. |
| **Performance** | Fine for **modal + weekly grid** (today’s [`training-log.ts`](../../src/lib/supabase/client/training-log.ts) already builds week objects in memory). Risk only if we naïvely recompute full matrices for **unbounded** history in one frame—mitigate with composite-only in lists, `useMemo`, virtualization, or server-side aggregation for year-long exports. |
| **Rank-weighted composite** | The 50/30/20 rule (renormalized for 1–2 goals) matches how humans prioritize; it prevents a “perfect #3 match” from looking like the best session overall. | Same formula could apply to stored scores, but then frozen math locks the headline. |

**Caveat:** If product later needs **audit-grade** immutability (“this was exactly 72% on the 2025 formula”), we would add optional persisted scores **in addition to** snapshot, keyed by `ALIGNMENT_SCORER_VERSION`. That is additive; the hybrid model does not block it.

**Bottom line:** Ordered `text[]` on profile + `goal_snapshot` on logs + pure TS scorer + rank-weighted composite is **coherent**, **extensible** (metadata column later), and **fits the existing Training Log architecture** without requiring jsonb query gymnastics for v1.

---

This document is the **authoritative product/tech spec** for this feature set; bump `ALIGNMENT_SCORER_VERSION` when heuristic tables change.
