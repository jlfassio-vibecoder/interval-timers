# Technical Design: Performance Lab (Mission Control)

**Status:** Draft  
**Last updated:** April 2, 2026  
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

- **Entry:** From Roster row actions, alongside **View Stats** — e.g. **Performance Lab** → `/trainer/roster/:userId/lab` (or `/trainer/roster/:userId/performance` — pick one slug and keep stable).
- **View Stats** remains `/trainer/roster/:userId` (existing `ClientDetailView`).
- Optional: tabs inside a thin **client shell** layout shared by Stats + Lab to reduce navigation churn.

### Suggested in-Lab navigation

| Area | Suggested slug / tab id | Notes |
|------|-------------------------|--------|
| Overview / program control | `program` | Default landing |
| Assignments library | `assign` | Programs, challenges, workouts, exercises |
| Calendar | `calendar` | Week / month; respects `profiles.timezone` |
| Message board | `messages` | Threaded or chronological |
| Weekly activity board | `week` | Mon–Sun Kanban |

---

## 4. Capability design

### 4.1 Edit, swap, or end the client’s program

**User intent:** Change what the client is running without ambiguous HUD state.

**Behavioral requirements**

- **Swap / set primary:** **Decision:** implement **server-authoritative** “trainer recommended active program” (see section 7). The client app reads this on load and aligns with `active-program-sync` / `enrollment-pick`; `localStorage` may still cache the resolved id for UX but must not override stale server state. Storage sketch: `user_programs` metadata and/or `client_training_preferences` keyed by `user_id` + `trainer_id`.
- **End program:** Set enrollment `status` to `completed` / `paused` / `cancelled` (normalize enum with existing schema). Define whether **end** removes from roster listing (probably not — roster is enrollment-based; “ended” still visible with filter).
- **Edit:** Distinguish **edit assignment** (start date, week offset, notes) from **edit program template** (Builder). Lab focuses on assignment + deep link “Open in Builder” for template edits.

**API sketch**

- `GET /api/trainer/clients/:userId/enrollments`
- `PATCH /api/trainer/clients/:userId/enrollments/:programId` — start_date, status, trainer notes
- `POST /api/trainer/clients/:userId/enrollments/:programId/end`
- `POST /api/trainer/clients/:userId/active-program` — **required:** trainer sets server-side recommended active program id

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

**MVP shape**

- Table `trainer_client_messages` (or generic `coaching_threads`): `id`, `trainer_id`, `client_id`, `author_role`, `body`, `created_at`, `read_at`, optional `attachment_url`
- `GET` paginated, `POST` create; optional **pin** or **system** messages (e.g. “Program swapped” audit)

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

---

## 6. Phased delivery (suggested)

| Phase | Scope |
|-------|--------|
| **P0** | Route + shell UI; enrollments read-only; end/swap program (minimal API); link to Builder |
| **P1** | Assign programs + workouts/WODs (MVP assignment table + client HUD surfacing) |
| **P2** | Calendar read API + basic drag-to-reschedule for assignment instances |
| **P3** | Message board MVP |
| **P4** | Weekly Kanban + exercise assignments |
| **P5** | Challenges: Challenge Factory import + assign flow (AI generation feeds factory, same pattern as Program Factory) |

Order can change if messaging is higher priority for your cohort.

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
