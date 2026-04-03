# Technical Design: Performance Lab (Mission Control)

**Status:** Draft — **P0 + P1 + P2 + P3 + P4 + P5 (MVP) implemented** (see section 6 and implementation summaries below).  
**Last updated:** April 8, 2026  
**Related:** [ROSTER_TRAINER_HUD_WORKFLOW_SWOT.md](./ROSTER_TRAINER_HUD_WORKFLOW_SWOT.md), `ClientDetailView` (“View Stats”), `RosterView`

---

## 1. Purpose

The **Performance Lab** is a trainer-facing workspace for a **single roster client**, complementary to **View Stats** (read-heavy: profile, aggregates, workout logs). Performance Lab is **action-heavy**: programming, scheduling, education assignments, async communication, and a weekly activity board.

**Product principle:** One client context (`userId`), multiple tabs or sections; stats remain the “what happened” lens; Performance Lab is “what we do next.”

---

## 2. Goals and non-goals

### Goals

- Let authorized trainers manage **program lifecycle** (edit context, swap primary assignment, end enrollment) without leaving Mission Control.
- Support **assignment** of programs, challenges, one-off workouts/WODs, and **educational exercises** with clear client surfacing rules.
- Provide a **calendar view** the trainer can reason about (and optionally mutate) per client timezone.
- Host a **durable message board** (async, scoped to trainer–client dyad).
- Provide a **weekly Kanban** (columns = days) for physical activity planning or tracking.

### Non-goals (initial phases)

- Real-time video or voice (separate app: `trainer-chat` exists in monorepo; integration TBD).
- Full replacement of the **Builder** admin surface for authoring program structure (deep edits stay in Builder; Lab may deep-link).
- Medical record storage or clinical documentation (stay within fitness coaching boundaries).

---

## 3. Information architecture and routing

### Placement

- **Entry (done):** Roster row **Lab** → `/trainer/roster/:userId/lab` (basename `/trainer`); slug **`lab`** is stable.
- **View Stats:** `/trainer/roster/:userId` index route (`ClientDetailView`).
- **Client shell (done):** `ClientMissionControlLayout` — shared header, **Back to Roster**, **View Stats** / **Performance Lab** tabs, `<Outlet />` for child routes.

### Suggested in-Lab navigation

| Area | Suggested slug / tab id | Notes |
|------|-------------------------|--------|
| Overview / program control | `program` | Default landing |
| Assignments library | `assign` | Programs, challenges, workouts, exercises |
| Calendar | `calendar` | Week / month; respects `profiles.timezone` |
| Message board | `messages` | Threaded or chronological |
| Weekly activity board | `week` | Mon–Sun Kanban |

**P0–P5 note:** The Lab route has **Programs**, **Calendar**, **Week**, and **Messages** tabs. P5 adds **challenge** assignments (published challenges from Challenge Factory). Calendar P2 is MVP (program read model + coach instances, not full unified AMRAP/timer merge). P4 adds exercise assignments and the weekly activity board.

---

## 4. Capability design

### 4.1 Edit, swap, or end the client’s program

**User intent:** Change what the client is running without ambiguous HUD state.

**Behavioral requirements**

- **Swap / set primary:** **Decision:** implement **server-authoritative** “trainer recommended active program” (see section 7). The client app reads this on load and aligns with `active-program-sync` / `enrollment-pick`; `localStorage` may still cache the resolved id for UX but must not override stale server state. Storage sketch: `user_programs` metadata and/or `client_training_preferences` keyed by `user_id` + `trainer_id`.
- **End program:** Set enrollment `status` to `completed` / `paused` / `cancelled` (normalize enum with existing schema). **P0:** only **`completed`** is implemented (`user_programs` today is `active` | `completed`). Define whether **end** removes from roster listing (probably not — roster is enrollment-based; “ended” still visible with filter).
- **Edit:** Distinguish **edit assignment** (start date, week offset, notes) from **edit program template** (Builder). Lab focuses on assignment + deep link “Open in Builder” for template edits.

**API sketch**

- `GET /api/trainer/clients/:userId/enrollments` — **done** (P0)
- `PATCH /api/trainer/clients/:userId/enrollments/:programId` — start_date, status, trainer notes — **not yet** (post-P0)
- `POST /api/trainer/clients/:userId/enrollments/:programId/end` — **done** (P0; sets `user_programs.status` to `completed` per current schema)
- `POST /api/trainer/clients/:userId/active-program` — **done** (P0); body `{ programId: string | null }` upserts `client_training_preferences`
- `GET /api/me/trainer-recommended-program` — **done** (P0); user JWT + RLS (not service-role–only); HUD reads recommendation via `AppContext` + `resolveActiveProgramIdForSession`

**Existing anchors:** `user_programs`, `source: 'trainer_assigned'`, `grantProgramAccess`, `fetchTrainerRoster`.

---

### 4.2 Assign programs, challenges, workouts, or WODs

**Model:** Treat assignments as **typed entities** with a common shape:

- `assignment_type`: `program` | `challenge` | `workout` | `wod`
- `resource_id` (program id, workout id, or challenge id)
- `assigned_by`, `assigned_at`, `starts_on`, `expires_on` (optional), `visibility`, `client_ack_at` (optional)

**Programs:** Reuse invite-time multi-select patterns (`/api/trainer/programs`); programs are **imported from the Program Factory** (same mental model as today). Server path similar to roster invite finalize (upsert `user_programs`).

**Challenges:** **Decision:** challenges are **first-class entities**, produced and curated in the **Challenge Factory** and **imported into assignments** the same way programs are imported from the Program Factory (not “programs tagged as challenge”). AI generation (`generate-challenge-chain`) feeds the factory pipeline; assignment in Lab references challenge ids like program ids.

**Workouts / WODs:** May be **instances** (scheduled) or **templates** assigned to a library. If workouts live inside `program_weeks`, assignment might be “inject workout into week N” vs standalone “send this WOD for Tuesday.”

**Client surfacing:** **Decision:** support **both** **in-app notifications** and **mobile web push** (see section 7). **Assignment table** should carry enough metadata for channels; email may remain a later channel.

**P1:** In-app HUD notifications for open assignments (`coach_assignment` in derived notifications + bell panel). Web push still future.

---

### 4.3 Assign exercises (education and form)

**User intent:** Prescribe **learn** content (e.g. `/exercises/[slug]/learn` or in-app education modules), not only workout structure.

**Design**

- `assignment_type: exercise` + `exercise_slug` or `content_id`
- Optional **coach note** and **due date**
- Client HUD: “Assigned by coach” list with completion checkbox or time-on-page metric (telemetry optional)

**Nice-to-have:** Link to **video form check** uploads (async); store `media` refs if storage pattern exists.

---

### 4.4 View and manage individual client calendars

**User intent:** See scheduled sessions in client local time; drag or pick dates for assignments.

**Data sources**

- Existing **calendar sync** flows in HUD (`SyncToCalendarModal`, `start_date` on enrollments) — Lab should **read** the same canonical schedule where possible.
- If schedule is only in `program_weeks` JSON, define a **read model** API: `GET /api/trainer/clients/:userId/calendar?from=&to=` returning normalized events (workout title, duration, source program, completion status if logged).

**Mutations**

- Moving a session might mean updating **assignment instance** rows rather than mutating shared program templates (avoid changing other clients’ programs).

**Timezone:** Use `profiles.timezone` with fallback to trainer or UTC; display always labeled.

---

### 4.5 Client message board

**User intent:** Async Q&A, check-in prompts, non-real-time coaching.

**P3 (MVP) done:** Table `trainer_client_messages` with `trainer_user_id`, `client_user_id`, `author_user_id`, `author_role`, `body`, `created_at`; service-role list/create behind roster gate; `GET/POST` trainer and `/api/me/coach-messages`; Lab **Messages** tab + HUD `CoachMessagesModal` (sidebar **Message coach** and notification **Coach messages** card). See **P3 implementation summary** in section 6.

**Original MVP shape (reference)**

- Optional generic `coaching_threads` naming was deferred; `read_at`, optional `attachment_url`
- Optional **pin** or **system** messages (e.g. “Program swapped” audit) — not in P3

**Not** a replacement for email/SMS; optional **email digest** later.

**Moderation / compliance:** Retention policy, export on account deletion — document in privacy review.

---

### 4.6 Physical activity Kanban (columns = days of week)

**User intent:** Plan or track **movement** across the week (not only structured workouts).

**Model options**

- **A. Planner:** Columns Mon–Sun; cards are **planned** activities (trainer or client adds); states: `planned` | `done` | `skipped`
- **B. Hybrid:** Cards **hydrate** from calendar assignments + allow ad-hoc “walk 20m” cards

**View mode (decision):** UI **toggle** between (1) **calendar-week–scoped** board (week picker, aligns with payroll/periodization weeks) and (2) **rolling 7 days** (always “today + 6” or equivalent). Same card model; filter/query changes by mode.

**Data**

- `weekly_board_id` per `(trainer_id, client_id, week_start_date)` or single rolling week
- Cards: `day_of_week` (0–6), `title`, `type`, `duration_minutes`, `notes`, `source_assignment_id` (nullable)

**UX:** Week picker; “Copy last week”; mobile-friendly horizontal scroll per row on small screens.

---

## 5. Cross-cutting concerns

### 5.1 Authorization

- Reuse `verifyRosterAccessRequest` and **roster membership** checks: trainer may only act for clients returned by `fetchTrainerRoster` (or explicit friend/host rules if extended).
- All Lab APIs: **server-side** enforcement; never rely on client Supabase alone for writes.

### 5.2 Audit trail

- Log program end, swap, and assignment creates (who/when/what) for support and coach accountability.

### 5.3 Performance

- Lab loads **after** client context; lazy-load calendar and messages tabs.
- Paginate message and calendar ranges.

### 5.4 Alignment with client HUD (from SWOT)

- Setting **start_date** and **server-side recommended active program** from Lab should directly improve **Continue** and **Your coach** consistency; coordinate with `active-program-sync` / `enrollment-pick` so client resolution prefers trainer recommendation over orphan `localStorage`.

**P0 done:** Trainer recommendation is persisted in `client_training_preferences`; client resolution prefers a **valid** server recommendation first, then `localStorage`, then hints / default pick (`resolveActiveProgramIdForSession`). `/api/me/trainer-recommended-program` uses the same JWT + anon Supabase pattern as invitation accept routes; recommendation fetch is **cached per user id** in `AppContext` so it does not refire on every `activeProgramId` change.

### 5.5 Data layer (P0)

- **Table:** `client_training_preferences` (`client_user_id`, `trainer_user_id`, `recommended_active_program_id`, `updated_at`), migration `20260402120000_client_training_preferences.sql`.
- **RLS (post–PR #127 review):** `20260403120000_client_training_preferences_rls.sql` — `authenticated` may `SELECT` own client rows and `FOR ALL` rows where `auth.uid() = trainer_user_id`; service role used by Mission Control APIs bypasses RLS as usual.

---

## 6. Phased delivery (suggested)

| Phase | Scope | Status |
|-------|--------|--------|
| **P0** | Route + shell UI; enrollments read-only; end program + set/clear recommended active program (APIs); Builder links; HUD sync + RLS + `/api/me` user-scoped read | **Completed** |
| **P1** | Assign programs + workouts/WODs (MVP assignment table + client HUD surfacing) | **Completed** |
| **P2** | Calendar read API + basic drag-to-reschedule for assignment instances | **Completed** (MVP — see P2 summary) |
| **P3** | Message board MVP | **Completed** (MVP — see P3 summary) |
| **P4** | Weekly Kanban + exercise assignments | **Completed** (MVP — see P4 summary) |
| **P5** | Challenges: Challenge Factory import + assign flow (AI generation feeds factory, same pattern as Program Factory) | **Completed** (MVP — see P5 summary) |

Order can change if messaging is higher priority for your cohort.

### P0 implementation summary (reference)

| Item | Notes |
|------|--------|
| Routing | `TrainerRoute`: nested `roster/:userId` → `ClientMissionControlLayout`; index = stats; `lab` = `PerformanceLabView` |
| UI | `PerformanceLabView`: Programs, Calendar, Week, Messages tabs; enrollment table, assignments (incl. challenges), Set active / Clear / End / Builder; Challenge Factory deep link from Programs tab |
| Roster | **Lab** button (program clients or rows with `programIds.length > 0`) |
| Server | `trainer-client-enrollments.ts`: enrollments fetch, end enrollment, set recommendation, `fetchTrainerRecommendationForAuthenticatedSupabaseUser` |
| Client HUD | `AppContext` + `active-program-sync.ts` (4th arg: trainer recommendation) |
| Not in P0 | `PATCH` enrollment; audit logging; in-app/push surfacing for assignments |

### P1 implementation summary (reference)

| Item | Notes |
|------|--------|
| Table | `client_coach_assignments`; migrations `20260404120000_client_coach_assignments.sql`, `20260404120001_client_coach_assignments_rls.sql` |
| Server | `trainer-client-assignments.ts`: list/create/revoke; program assign upserts `user_programs` with `trainer_assigned`; workout/WOD ownership checks |
| Trainer APIs | `GET/POST .../clients/[userId]/assignments`, `POST .../assignments/[assignmentId]/revoke`, `GET /api/trainer/workouts`, `GET /api/trainer/wods` |
| Client APIs | `GET /api/me/coach-assignments`, `PATCH /api/me/coach-assignments/[assignmentId]` (dismiss), `GET .../payload` (workout/WOD Artist or program id) |
| Lab UI | `PerformanceLabView`: type picker, assign, assignments table + revoke |
| Client play | `/workout/assigned?assignmentId=` + `AssignedCoachWorkoutPage` + `WorkoutDetailModal` |
| HUD | `derive-notifications` merges coach assignments; `NotificationPanel` Open / Dismiss; `useDerivedNotifications` refresh key from HUD shell |
| Not in P1 | Challenges; web push; `PATCH` enrollment dates |

### P2 implementation summary (reference)

| Item | Notes |
|------|--------|
| Table | `client_coach_schedule_instances`; migration `20260430112000_client_coach_schedule_instances.sql` (root + `apps/app` mirror) |
| RLS | Client `SELECT` own rows; trainer `SELECT` with `is_mission_control_staff()`; writes via service-role APIs only |
| Server | `trainer-client-calendar.ts`: program events via `getCalendarEventsForRange` + `user_workout_logs` completion map; coach instances merged; roster gate |
| Trainer APIs | `GET .../clients/[userId]/calendar?from=&to=` (max 93 days); `POST .../calendar/instances`; `PATCH .../calendar/instances/[instanceId]` |
| Lab UI | `PerformanceLabView` tabs; `PerformanceLabCalendarSection`: week nav, dnd-kit drag for coach instances, add-instance row |
| Not in P2 (deferred) | Full unified trainer calendar (AMRAP/timer/readiness) without refactoring client `calendar-unified` to server; `PATCH user_programs.start_date` from Lab; instance auto-create on assign; audit log for moves |

### P3 implementation summary (reference)

| Item | Notes |
|------|--------|
| Table | `trainer_client_messages`; migration `20260406120000_trainer_client_messages.sql` (root + `apps/app` mirror); table `COMMENT` documents service-role API path vs JWT `SELECT` RLS |
| RLS | Client `SELECT` own rows; trainer `SELECT` with `is_mission_control_staff()`; writes via service-role APIs only |
| Roster gate | `isProgramClientOfTrainer` in `trainer-roster.ts` (program clients only; not host–buddy) |
| Server | `trainer-client-messages.ts`: capped body (8000), PostgREST `.range` window (`pageSize + 1` probe), `partitionTrainerClientMessageFetch`, list + create |
| Trainer APIs | `GET/POST .../clients/[userId]/messages` (`cursor`, `limit`); hosts get 404; service-layer `Not allowed` → 404 in handlers (aligned with roster copy) |
| Client APIs | `GET/POST /api/me/coach-messages` with `trainerUserId` query/body |
| Lab UI | `PerformanceLabMessagesSection`; **Messages** tab in `PerformanceLabView` |
| Client HUD | `CoachMessagesModal`: **Message coach** on `TrainerCard`; **Coach messages** card in `NotificationPanel` + shared modal from `HUDShell` (does not affect bell count) |
| Reliability / a11y | Full-load generation ref + optimistic POST append (send vs **Load older** races); modal Escape + non-focusable backdrop; Vitest: cursor + pagination partition |
| Not in P3 (deferred) | `read_at`, attachments, threading, pins/system messages, Realtime, email digest, retention/export policy |

### P4 implementation summary (reference)

| Item | Notes |
|------|--------|
| Exercise schema | `20260407120000_client_coach_assignments_exercise.sql` (root + `apps/app` mirror): `assignment_type` includes `exercise`; nullable `resource_id`; `exercise_slug`, `coach_note`, `due_on`; CHECK constraints |
| Kanban schema | `20260407120100_client_weekly_activity_board.sql`: `client_weekly_activity_boards`, `client_weekly_activity_cards` (`scheduled_date`, `status` planned/done/skipped); client + trainer MC `SELECT` RLS; writes via service-role APIs |
| Roster gate (Kanban) | **`isProgramClientOfTrainer`** (same as P3 messages), not full host roster |
| Server | `trainer-client-assignments.ts`: exercise create/list/payload; slug validated against approved generated exercises. `trainer-client-weekly-board.ts`: list/create/update/delete; client status-only update |
| Date helpers | `lib/performance-lab/weekly-board-dates.ts` (Mon-start local week); Vitest `tests/lib/weekly-board-dates.test.ts` |
| Trainer APIs | `GET/POST .../clients/[userId]/weekly-board?weekStart=`; `PATCH/DELETE .../weekly-board/cards/[cardId]`; `GET /api/trainer/exercises` (published list for Lab picker) |
| Client APIs | `GET/PATCH /api/me/weekly-activity` with `trainerUserId` + `weekStart` / `cardId` + `status` |
| Lab UI | `PerformanceLabView`: **Week** tab, `PerformanceLabWeekSection` (calendar week vs rolling 7 days, Mon–Sun columns, CRUD); Programs tab: **Exercise** assign + note/due; “Coming soon” no longer lists weekly board |
| HUD | `derive-notifications` + `NotificationPanel` exercise deep links (`open_exercise`); payload route JSON for exercise type |
| Not in P4 (deferred) | Kanban hybrid hydration from calendar; “Copy last week”; exercise video form check; assignment/board telemetry; audit tables for board edits |

### P5 implementation summary (reference)

| Item | Notes |
|------|--------|
| Schema | `20260408120000_client_coach_assignments_challenge.sql` (root + `apps/app` mirror): `assignment_type` includes `challenge`; same `resource_id` + exercise-column NULL shape as program/workout/wod |
| Server | `trainer-client-assignments.ts`: validate `challenges.author_id` + `status = published`; `grantChallengeAccess` → `user_challenges`; list client rows with `action: open_challenge`, `href` `/challenges/[id]`; payload branch for client |
| Trainer API | `GET /api/trainer/challenges` — published challenges by `author_id`; hosts get `[]` (picker parity with programs) |
| Client API | `GET .../coach-assignments/[id]/payload` JSON for `challenge` |
| Lab UI | `PerformanceLabView`: **Challenge** assign type + picker; copy + link to admin Challenge Factory |
| HUD | `derive-notifications` + `open_challenge`; `NotificationPanel` uses `coachHref` (unchanged) |
| Not in P5 (deferred) | Challenge rows on trainer calendar; revoke assignment removes `user_challenges`; assigning draft challenges; new AI chain changes (factory + `generate-challenge-chain` already exist) |

---

## 7. Resolved decisions

| Topic | Decision |
|-------|----------|
| **Challenges vs tagged programs** | **Separate entities.** Challenges live in the **Challenge Factory**; trainers **import** them into client assignments **like programs from the Program Factory** (first-class challenge ids, not a program `kind` flag). |
| **Trainer recommended active program** | **Server-side source of truth.** Implement persisted “trainer recommended active program” (API + schema); client reads it on load and reconciles with `localStorage` / `enrollment-pick` so HUD and Lab stay aligned (per [ROSTER_TRAINER_HUD_WORKFLOW_SWOT.md](./ROSTER_TRAINER_HUD_WORKFLOW_SWOT.md)). |
| **Kanban time scope** | **Both modes via toggle:** (1) **calendar-week–scoped** board and (2) **rolling 7-day** view. Same underlying cards; query/UI switches. |
| **Push notifications** | **Both:** **in-app** notifications **and** **mobile web push** (not a phased either/or—ship both; sequencing within implementation can still favor wiring in-app first if needed). |

---

## 8. Appendix — Coverage check: traditional, nice-to-have, and AI

### 8.1 Traditional trainer-platform capabilities you may want (gaps vs your list)

| Capability | Why it matters |
|------------|----------------|
| **Compliance / PAR-Q, waivers, liability** | Reduces legal exposure; store acceptance timestamps. |
| **Payment & packages** | Session credits, subscription state (Stripe exists in monorepo MCP context). |
| **Session notes (private)** | Structured SOAP/subjective notes separate from client-visible board. |
| **Goals & periodization** | Mesocycle view, deload weeks, KPIs (strength numbers, body comp). |
| **Habit / lifestyle tracking** | Sleep, steps, nutrition photo log — often separate from workout calendar. |
| **File / photo homework** | Form check videos, meal photos — ties to exercises + messaging. |
| **Groups / team programs** | One assignment → many clients (classes). |
| **Templates from coach library** | Save “this week’s stack” as reusable for other clients. |
| **Client self-logging** | RPE, pain flags, “missed workout” reason — feeds stats and alerts. |
| **Alerts & automations** | “No login in 7 days”, “missed 3 workouts” — rules engine light. |
| **Export / handoff** | PDF summary or data export when client changes coach. |

### 8.2 Nice-to-haves (UX and ops)

- **Command palette** in Lab for power users (“assign leg day template”).
- **Undo** for destructive actions (end program) within 24h.
- **Diff view** when swapping programs (“what changes for the client this week”).
- **Preview as client** (impersonation or read-only mirror) for support.
- **Keyboard shortcuts** on Kanban and calendar.

### 8.3 AI components aligned with this codebase

| Idea | Existing leverage |
|------|-------------------|
| **Weekly plan draft** | Prompt chain / Vertex patterns used for programs and `generate-challenge-chain`. |
| **Natural language assignment** | “Add two strength days and a recovery walk” → proposed calendar + Kanban cards for coach approval. |
| **Exercise education matching** | Given profile limitations (`physical_limitations`, goals), suggest learn articles and form cues — taxonomy helpers already in `ClientDetailView`. |
| **Message assist** | Suggest replies on the board (tone, brevity); keep human-in-the-loop. |
| **Alignment insight extension** | Extend goal-alignment scoring with **planned vs completed** from Kanban/calendar. |
| **Risk flags** | Pattern detection on logs + messages (“mentions pain repeatedly”) — advisory banner only, not diagnosis. |

### 8.4 Summary

Your six pillars cover the **core coaching loop** (programming, scheduling, education, comms, weekly structure). The largest **traditional** gaps for a full “training platform” are **billing**, **compliance**, **private clinical-style notes**, and **group** semantics. The highest-leverage **AI** additions are **NL → proposed schedule**, **education matching to profile**, and **coach reply assist**, all gated by explicit trainer approval before client visibility.

---

## 9. Document history

| Date | Author | Change |
|------|--------|--------|
| 2026-04-02 | — | Initial draft |
| 2026-04-02 | — | Resolved section 7 decisions: Challenge Factory, server active program, Kanban toggle, in-app + web push |
| 2026-04-02 | — | P0 shipped: `client_training_preferences`, `/trainer/roster/:userId/lab`, enrollments + active-program APIs, `GET /api/me/trainer-recommended-program`, HUD merge in `resolveActiveProgramIdForSession` |
| 2026-04-03 | — | Doc: P0 marked complete; implementation summary, API/RLS notes, phase status column; Copilot follow-ups: RLS migration, user-scoped `/api/me`, AppContext recommendation cache |
| 2026-04-04 | — | P1 shipped: `client_coach_assignments`, trainer + `/api/me` assignment APIs, Performance Lab assign UI, HUD notification panel + `/workout/assigned`; doc P1 summary |
| 2026-04-05 | — | P2 MVP: `client_coach_schedule_instances`, `GET/PATCH/POST` trainer calendar APIs, `trainer-client-calendar.ts`, Lab Calendar tab + dnd-kit; doc P2 summary + deferred list |
| 2026-04-06 | — | P3 MVP: `trainer_client_messages`, `GET/POST` trainer + `/api/me/coach-messages`, `trainer-client-messages.ts`, Lab Messages tab, `CoachMessagesModal` in `TrainerCard`; doc P3 summary + deferred list |
| 2026-04-07 | — | P3 marked complete in narrative: section 3 (Messages tab shipped), section 4.5 cross-link; P3 summary expanded (HUD bell + shell, API 404 mapping, pagination helper/tests, race + modal follow-ups); last-updated bump |
| 2026-04-02 | — | P4 MVP: exercise assignments + weekly board migrations, trainer + `/api/me/weekly-activity`, Lab Week tab + exercise assign UI, doc P4 summary + phase status; deferred hybrid calendar, copy week, telemetry, audit |
| 2026-04-08 | — | P5 MVP: `challenge` assignment type migration, `grantChallengeAccess`, `GET /api/trainer/challenges`, Lab assign + Challenge Factory link, HUD `open_challenge` + payload; doc P5 summary + phase status |
