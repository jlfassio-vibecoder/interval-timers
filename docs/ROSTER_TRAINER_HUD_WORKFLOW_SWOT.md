# SWOT: Roster View ↔ Trainer ↔ Client HUD Workflow

**Scope:** End-to-end flow when a trainer invites a client and assigns program(s), and how that relates to the HUD **Active program** and **Your coach** cards.  
**Date:** April 1, 2026  
**Context:** Published programs can appear under **All programs** in the HUD while the assigned coach and “active” assignment do not feel connected—this analysis maps architectural causes and strategic tradeoffs.

---

## Workflow snapshot (as implemented)

1. **Roster (trainer-facing)** — `RosterView` submits `POST /api/trainer/roster/invite` with selected `programIds`. The server creates a `roster_invitations` row and, on accept, upserts `user_programs` with `source: 'trainer_assigned'` for each program (`finalizeRosterInvitationAfterInviteeVerified` in `roster-invitations.ts`).
2. **Trainer roster listing** — `fetchTrainerRoster` uses the **server** Supabase client to list clients enrolled in programs owned by `programs.trainer_id === trainerId` (bypasses RLS).
3. **Client HUD — All programs** — `ProgramSidebar` calls `fetchUserPrograms`, which reads the client’s `user_programs` rows (with joined program metadata). Assigned programs and self-serve purchases share this list; `trainer_assigned` is used for upgrade/lock behavior (`ProgramSidebar.showLock`).
4. **Client HUD — Active program** — The highlighted program is **`activeProgramId` in `AppContext`**, persisted in `localStorage`. It is **not** automatically set when an invite is accepted. If nothing is selected, the UI shows “Tap a program below to set as active.” Week progress and **Continue** depend on `start_date` via `getCurrentWeek`; invite enrollment does not set `start_date`, so the card often shows **Not started** and disables **Continue** until the user syncs a calendar start date.
5. **Client HUD — Your coach** — `TrainerCard` uses `trainerProfile` from `AppContext`, loaded by **`getTrainerForUser(userId, activeProgramId)`** (`trainer-resolver.ts`). That resolver loads `programs.trainer_id`, then the **trainer’s row in `profiles`**. The `/welcome` path uses a **server-only** helper (`welcome-trainer.ts`) that documents a key constraint: default **RLS on `profiles` does not allow clients to read another user’s profile**, so client-side coach resolution can fail even when enrollment exists.

---

## Strengths

| Area | Detail |
|------|--------|
| **Single enrollment source of truth** | `user_programs` backs both the trainer’s roster (via server queries) and the client’s All programs list—no duplicate “assignment” table to drift. |
| **Explicit assignment semantics** | `source: 'trainer_assigned'` cleanly drives product rules (e.g. treat assigned clients like paid for lock/CTA behavior in the HUD). |
| **Server-side trainer context for marketing flows** | `getWelcomeClientTrainerContext` prioritizes `trainer_assigned` enrollments and can show trainer/studio branding on `/welcome` without relying on client-side profile reads. |
| **Program visibility for assigned clients** | Migration `20260430104000_programs_select_for_enrolled_clients.sql` allows clients to `SELECT` programs they are actively enrolled in—fixing gaps where only public or trainer-owned rows were visible (needed for `trainer_id` resolution). |
| **Trainer roster API** | Uses elevated server access so coaches see client emails/names consistently; not blocked by trainee-scoped RLS. |

---

## Weaknesses

| Area | Detail |
|------|--------|
| **HUD “active program” is UI state, not enrollment** | `activeProgramId` is local-only until the user taps a program. Invite acceptance does not set it, so the **Active program** card can stay empty while **All programs** lists the assignment. |
| **Coach card depends on client-readable trainer profile** | `getTrainerForUser` selects the coach’s `profiles` row by `programs.trainer_id`. Under typical policies (“Users can read own profile”), **clients cannot read the coach’s profile**, so `trainerProfile` is often `null` and the card shows “No coach assigned…” despite a valid roster relationship. |
| **No default start date on assignment** | Without `start_date`, `getCurrentWeek` returns `not_started`, which **disables Continue** and weakens the “assigned program” story in the primary HUD actions. |
| **Two resolution paths diverge** | Welcome/server flows can show trainer context; the HUD uses client Supabase queries—**behavior is inconsistent** unless RLS or APIs align. |
| **Mental model vs. labels** | “Your coach” implies roster/invite relationship; implementation ties coach display to **program author** (`programs.trainer_id`) + profile read, not to `roster_invitations` or inviter id. |

---

## Opportunities

| Area | Detail |
|------|--------|
| **Align HUD coach with server truth** | Expose trainer display via an authenticated API or RPC (similar to roster invite preview / welcome) that returns safe public fields only, or add a narrow RLS policy: e.g. allow `SELECT` on `profiles` where the user is enrolled in a program with `trainer_id = profiles.id`. |
| **Auto-select active program on first assignment** | On invite acceptance (or first load with a single `trainer_assigned` enrollment), set `activeProgramId` to the assigned `program_id` so the Active card and `getTrainerForUser` stay in sync. |
| **Optional default schedule start** | Set `start_date` on assignment (e.g. today or next Monday) or prompt immediately in onboarding so week progress and **Continue** activate without extra taps. |
| **Reuse welcome prioritization in the client** | Mirror `pickActiveEnrollment` ordering (`trainer_assigned` → `cohort` → `self`) when `activeProgramId` is null so the “default” active program matches product intent. |
| **Roster UX clarity** | In Roster View, surface which programs are linked per client (already in data model); link documentation so trainers know the client must pick an active program + calendar start for full HUD value. |

---

## Threats

| Area | Detail |
|------|--------|
| **Trust and support load** | Trainers see clients on the roster; clients see programs but not coach/active state—**mismatched expectations** (“I assigned them”) vs. what the HUD shows. |
| **Fragile client-side coach feature** | Any RLS or schema change to `programs`/`profiles` can silently break `getTrainerForUser` (returns `null`), with no user-visible error—hard to debug in production. |
| **Multi-program clients** | Multiple `trainer_assigned` rows + stale `localStorage` `activeProgramId` can point at the wrong program; coach resolution follows `activeProgramId` first, then “first” enrollment—**ambiguous** without explicit UI. |
| **Regression risk across surfaces** | Fixes that touch enrollment, `programs.trainer_id`, or profile visibility affect Roster, Programs store, HUD, and Welcome—**integration tests** around invite accept → HUD load are valuable. |

---

## Summary

The roster and invite pipeline correctly **writes** trainer assignments to `user_programs`, which **feeds All programs**. The HUD’s **Active program** and **Your coach** cards, however, depend on **separate mechanisms** (local active selection, calendar start date, and client-side trainer/profile resolution). The largest structural gap for “coach not showing” is likely **profile visibility under RLS**, not missing enrollment rows; the largest gap for “assigned program not active” is **local `activeProgramId` + `start_date`**, not the publish/assign pipeline itself.

---

## References (code)

| Piece | Location |
|-------|----------|
| Invite finalize → `user_programs` | `apps/app/src/lib/supabase/admin/roster-invitations.ts` |
| Roster UI | `apps/app/src/components/react/trainer/views/RosterView.tsx` |
| Trainer roster (server) | `apps/app/src/lib/supabase/admin/trainer-roster.ts` |
| HUD Program sidebar | `apps/app/src/components/react/hud/ProgramSidebar.tsx`, `TrainerCard.tsx` |
| Client trainer resolution | `apps/app/src/lib/supabase/client/trainer-resolver.ts` |
| Welcome trainer (server, documents RLS) | `apps/app/src/lib/supabase/admin/welcome-trainer.ts` |
| Programs readable when enrolled | `supabase/migrations/20260430104000_programs_select_for_enrolled_clients.sql` |
