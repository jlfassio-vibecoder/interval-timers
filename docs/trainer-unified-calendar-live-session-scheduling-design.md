# Technical design: Scheduled live sessions from the unified trainer calendar

**Status:** Draft — **Option B implemented in app** (core P0–P2); see **§10.1** for detailed status and gaps.  
**Date:** 2026-04-06 (implementation status updated 2026-04-06)  
**Related:** [trainer-unified-mission-control-calendar-design.md](./trainer-unified-mission-control-calendar-design.md), [trainer-roster-calendar-swot.md](./trainer-roster-calendar-swot.md), `buildTrainerUnifiedCalendarPayload` (`trainer-unified-calendar.ts`)

---

## 1. Purpose

Define how trainers **schedule** live sessions and **attach clients** (single and recurring) from **Mission Control’s unified calendar**, with:

- **Projection onto both** the trainer unified calendar and each client’s calendar (HUD and/or Mission Control client view).
- **Invitee acceptance** before a scheduled block is treated as a firm commitment.
- Support for **existing roster clients** and for **prospective clients**, using the product’s **invitation** flows (roster + welcome landing), noting that today `apps/app/src/pages/api/welcome/` exposes only [`trainer-display`](apps/app/src/pages/api/welcome/trainer-display.ts) (welcome context); **email delivery and onboarding** for net-new users align with existing **roster invitation** APIs and welcome pages rather than a separate “welcome-only” scheduler API.

---

## 2. Goals and non-goals

### 2.1 Goals

| ID | Goal |
|----|------|
| G1 | Trainers create **scheduled** live session occurrences (not only “start now”) from the unified calendar UI. |
| G2 | Support **one-off** and **recurring** series (e.g. weekly class) with stable identity for edits/cancellations. |
| G3 | Each **invitee** must **accept** (or explicitly decline) before the occurrence counts as confirmed for reporting and client calendar “busy” semantics. |
| G4 | **Existing clients** on the trainer’s roster are invited by `user_id` (and optionally email for notifications). |
| G5 | **Non-users / not-yet-on-roster** invitees enter a **workflow** that issues a **roster invitation** (and/or magic link) consistent with [`/api/trainer/roster/invite`](apps/app/src/pages/api/trainer/roster/invite.ts) and [`trySendRosterInviteEmail`](apps/app/src/lib/supabase/admin/roster-invite-delivery.ts), with optional query params so post-signup the client lands on **accept live session** or **welcome** context. |
| G6 | Unified calendar shows **one row per occurrence** (or per series expand) with participant summary; client calendar shows **only that client’s** participation row. |

### 2.2 Non-goals (initial phase)

- Full calendar sync (Google/Outlook) — out of scope; export can reuse existing `.ics` patterns later.
- Replacing the **live runtime** model (`trainer_live_sessions` / `trainer_live_create_session`) — scheduled rows are **planning**; the **actual** room still spins up at go-live time (see §7).
- SMS-first invites — roster invite already documents phone gaps; same applies here.

---

## 3. Current state (baseline)

### 3.1 Live sessions today

- Tables: `trainer_live_sessions` (`created_at`, `ended_at`, `status`, …), `trainer_live_participants` ([`20260430113000_trainer_live_video.sql`](supabase/migrations/20260430113000_trainer_live_video.sql)).
- Sessions are effectively **created at join time**; `created_at` is used as the **start** in [`fetchUnifiedLiveSessionItems`](apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts).
- There is **no** first-class scheduled start time, **no** recurrence, **no** invite acceptance state tied to calendar rows.

### 3.2 Unified calendar today

- [`GET /api/trainer/calendar/unified`](apps/app/src/pages/api/trainer/calendar/unified.ts) returns `buildTrainerUnifiedCalendarPayload`: merges **live session** items for the trainer with **per-client** events from `buildTrainerClientCalendarPayload`.
- Live rows are **grouped**; coach instances linked to the same `trainer_live_session_id` are deduplicated.

### 3.3 Invitations today

- **Roster:** `roster_invitations` + `createRosterInvite` + POST `/api/trainer/roster/invite` — appropriate for **new** clients (email/phone + optional `programIds`).
- **Welcome API:** `GET /api/welcome/trainer-display` — **read-only** context for welcome UI (trainer name, studio, enrollment count), not invite delivery.
- Product expectation: **new** client onboarding continues to flow through **roster invite + accept** (and welcome landing), not a parallel unsupported endpoint under `welcome/` alone.

---

## 4. Conceptual model

### 4.1 Entities

1. **Schedule series (optional parent)**  
   - Holds recurrence rule (e.g. RRULE or app-defined `frequency` + `interval` + `until` / `count`).  
   - Owned by `trainer_user_id`.

2. **Occurrence**  
   - A single wall-time interval: `scheduled_start_at`, `scheduled_end_at` (timestamptz), `timezone` for display (trainer profile or explicit override).  
   - Belongs to a series or stands alone.

3. **Live session plan**  
   - Links an occurrence to **zero or one** future `trainer_live_sessions.id` once the room is opened (nullable until go-live).  
   - Trainers may attach “template” metadata: `shell`, max clients, notes.

4. **Invite**  
   - One row per `(occurrence × invitee)` with `status`: `pending` | `accepted` | `declined` | `waitlisted` | `expired` | `cancelled` (see §11.1 for capacity vs waitlist).  
   - Invitee target: `invitee_user_id` (nullable until signup) **and/or** `invitee_email` / `invitee_phone` for pre-account matching.

5. **Roster invitation bridge (new clients)**  
   - When `invitee_user_id` is null, link to `roster_invitations.id` or store `pending_invite_token` / email to correlate signup → auto-attach invite acceptance.

### 4.2 Acceptance semantics

- **Trainer view:** show occurrence with counts: pending / accepted / declined; optional “nudge” resend.
- **Client view:** show **pending** invites (action: Accept / Decline) and **accepted** future items on the calendar.
- **Conflict rules:** acceptance may be blocked if the client already has a hard conflict (reuse coach overlap rules from unified design doc); optional trainer override.

---

## 5. Data storage

Exact migration names and RLS policies are implementation follow-ups.

### 5.1 Option A — Minimal (fewer tables) — **not selected**

- Add **`scheduled_start_at`**, **`scheduled_end_at`**, **`series_id` nullable** to `trainer_live_sessions` for **planned** sessions that are not yet “live”, with `status` extended: `scheduled` | `active` | `ended` | `cancelled`.
- Add **`trainer_live_session_invites`** with FK to `session_id`, invitee fields, `status`, `roster_invitation_id` nullable.

**Limitation:** Recurring series expansion and “edit this occurrence only” are harder without a separate occurrence table.

### 5.2 Option B — Recommended for recurrence (cleaner) — **greenlit**

**Decision:** Implement scheduled live scheduling on **Option B** (occurrences + series + invites).

- **`trainer_live_session_occurrences`**  
  - `id`, `trainer_user_id`, `series_id` nullable, `scheduled_start_at`, `scheduled_end_at`, `status` (`scheduled` | `cancelled` | `completed`), `live_session_id` nullable (FK to `trainer_live_sessions` when started).

- **`trainer_live_session_series`**  
  - Recurrence metadata, trainer ownership, default shell/settings.

- **`trainer_live_session_invites`**  
  - `occurrence_id`, invitee keys, `status`, acceptance timestamps, `roster_invitation_id` nullable FK to `roster_invitations`.  
  - **Waitlist:** invite rows may use extended status (e.g. `waitlisted`) when accepted count exceeds **class capacity**; see §11.1.

**Projection:** `buildTrainerUnifiedCalendarPayload` queries **occurrences** in range (not only `trainer_live_sessions.created_at`), and joins invites for labels. Existing **runtime** sessions remain as today when `live_session_id` is set and status is active.

---

## 6. APIs (sketch)

### 6.1 Trainer (Mission Control, authenticated + roster checks)

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/api/trainer/live-schedule/occurrences` | Create single occurrence + invite list (user ids + optional email-only prospects). |
| `POST` | `/api/trainer/live-schedule/series` | Create recurring series + default invitee list; server expands occurrences in range or on demand. |
| `PATCH` | `/api/trainer/live-schedule/occurrences/:id` | Reschedule, cancel, or adjust invitees. |
| `POST` | `/api/trainer/live-schedule/invites/:id/resend` | Resend notification (email/in-app). |

Implementation should reuse `verifyRosterAccessRequest` / `isUserInViewerRoster` patterns from [`trainer-client-calendar`](apps/app/src/lib/supabase/admin/trainer-client-calendar.ts).

### 6.2 Client

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/client/live-schedule/invites` | Pending + upcoming accepted for `auth.uid()`. |
| `POST` | `/api/client/live-schedule/invites/:id/accept` | Accept (with optional conflict check). |
| `POST` | `/api/client/live-schedule/invites/:id/decline` | Decline. |

RLS: clients only see rows where they are the invitee (by `user_id` or matched email after verification).

### 6.3 New client (no account yet)

1. Trainer adds **email** (not on roster).  
2. Server creates **`roster_invitations`** row (via existing `createRosterInvite`) **and** a **`trainer_live_session_invites`** row in `pending` state linked by `roster_invitation_id` or shared token — **in one transaction** (§11.4).  
3. `trySendRosterInviteEmail` sends the standard invite; **deep link** query params (e.g. `liveInviteId=…`) point to welcome/accept flow so after auth the client is prompted to **accept the live session** as well as roster membership.  
4. On signup, webhook or client callback **binds** `auth.users.id` to the pending live invite.

**Note:** Extending [`/api/welcome/trainer-display`](apps/app/src/pages/api/welcome/trainer-display.ts) is optional; it only enriches UI. **Invite binding** is better handled in **roster accept** or a dedicated small endpoint under `/api/trainer/...` or `/api/invitations/...` to avoid overloading GET welcome.

---

## 7. Go-live (runtime) bridge

Scheduled occurrences are **not** the same as an active Agora/live room.

Recommended flow:

1. **T−5 min (optional):** notify participants who accepted.  
2. **Trainer taps “Start”** on occurrence → existing `trainer_live_create_session` (or variant) creates `trainer_live_sessions`, sets `occurrence.live_session_id`.  
3. **Clients join** via current `trainer_live_join_session` with caps driven by **configured class capacity** (see §11.1; **6** concurrent clients today, subject to future product change).  
4. **Ended:** `ended_at` set; occurrence `status = completed`.

If trainer never starts, occurrence moves to `missed` or `cancelled` per product policy.

---

## 8. Calendar projection rules

### 8.1 Trainer unified calendar

- Query occurrences in `[from, to]` by `scheduled_start_at` in viewer timezone (see [`fetchClientTimezone`](apps/app/src/lib/supabase/admin/trainer-client-calendar.ts) for viewer).  
- Render one card per occurrence with **participant chips** (accepted / pending counts).  
- Dedup: if `coach_instance` references `trainer_live_session_id` already shown as a grouped live row, skip duplicate (existing pattern in [`buildTrainerUnifiedCalendarPayload`](apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts)).

### 8.2 Client calendar (HUD)

- Extend [`getUnifiedCalendarEvents`](apps/app/src/lib/calendar-unified.ts) / client feed to include **accepted** occurrences (and optionally **pending** in a sidebar or striped style).  
- Storage: same occurrence table; filter `invites.status = accepted` AND `invitee_user_id = client`.

---

## 9. Notifications

- **Email:** reuse roster delivery patterns; add templates for “live session invite” and “reminder”.  
- **In-app:** optional Realtime on `trainer_live_session_invites` or polling on client Mission Control / HUD.

---

## 10. Phasing

| Phase | Scope |
|-------|--------|
| **P0** | Single occurrence + invites to **existing roster clients** only; accept/decline; unified + client calendar read paths. |
| **P1** | Recurrence + series edit; new-client path via **roster invite** + linked live invite token. |
| **P2** | Reminders, **waitlist UX** (policy greenlit in §11.1), conflict engine integration with coach instances, `.ics` for occurrences. |

### 10.1 Implementation status (as of 2026-04-06)

This section maps the design to the current codebase. Paths are under `apps/app/` unless noted.

#### Phased scope

| Phase | Status | Notes |
|-------|--------|--------|
| **P0** | **Done** | Single occurrence + roster-client invites; `POST /api/trainer/live-schedule/occurrences`; client accept/decline RPCs; unified calendar shows scheduled occurrences (`fetchScheduledLiveOccurrencesForTrainer`); HUD merges `live_scheduled` via `getUnifiedCalendarEvents` + `getLiveScheduledCalendarEventsForRange`. |
| **P1** | **Done** | Weekly series + materialized occurrences + prospects (`POST /api/trainer/live-schedule/series`, `roster_invitation_id` bridge); `PATCH /api/trainer/live-schedule/occurrences/:id` and series patch; roster invite email on create. |
| **P2** | **Done** (see gaps below) | Reminder columns + cron route `GET/POST /api/cron/scheduled-live-reminders` (`live-schedule-reminders.ts`); waitlist promotion on decline of **accepted** (`trainer_live_schedule_invite_decline` in `20260406180000_trainer_live_schedule_p2_reminders_waitlist.sql`); trainer conflict checks include **`scheduled_live_occurrence`** in `findCoachScheduleConflictsForTrainer`; live-schedule create/patch/series support **`allowOverlap`** with **409 + `conflicts`**; HUD `.ics` includes timed **`live_scheduled`** (`buildIcsFromEvents`); waitlist position + styling (`live-scheduled-calendar.ts`, `AppCalendar.tsx`, `LiveScheduledInviteDrawer.tsx`). |

#### Goals (§2.1)

| ID | Status | Notes |
|----|--------|--------|
| G1–G6 | **Met** | “Schedule live” on unified calendar (`TrainerUnifiedCalendarView.tsx`); series + one-off; accept/decline + capacity/waitlist in `trainer_live_schedule_invite_accept`; roster + prospect path via `createLiveScheduleOccurrence` / series. |

#### APIs (§6)

| Item | Status | Notes |
|------|--------|--------|
| `POST …/occurrences`, `POST …/series`, `PATCH …/occurrences/:id` | **Done** | As documented. |
| `POST …/live-schedule/invites/:id/resend` | **Not implemented** | No dedicated resend route; roster resend exists for **`roster_invitations`** only. Trainers can rely on initial prospect email or future live-invite resend. |
| `GET /api/client/live-schedule/invites` | **Not implemented** | Clients discover invites through **calendar merge** (`getLiveScheduledCalendarEventsForRange`) rather than a list API. |
| `POST …/accept` / `decline` | **Done** | Under `api/client/live-schedule/invites/[inviteId]/`. |

#### Notifications (§9)

| Item | Status | Notes |
|------|--------|--------|
| Invite email (prospects) | **Done** | `trySendRosterInviteEmail` on prospect create. |
| Reminder email | **Done** | ~24h / ~1h windows; **accepted** invitees only; Resend when `RESEND_API_KEY` + `RESEND_FROM` set; flags `reminder_24h_sent_at` / `reminder_1h_sent_at` on occurrences. **Waitlisted** invitees are not emailed reminders (product could extend later). |
| In-app / Realtime | **Not implemented** | No bell/notification rows for reminders; optional per §9. |
| §7 optional **T−5 min** push | **Not implemented** | Separate from P2 reminder cadence. |

#### Go-live bridge (§7)

| Item | Status | Notes |
|------|--------|--------|
| Trainer “Start” on occurrence → `trainer_live_sessions` + `occurrence.live_session_id` | **Not implemented** | Schema supports `live_session_id`; no documented UI/API flow yet wires scheduled occurrence to session create. |
| Auto **missed** / **cancelled** if trainer never starts | **Not implemented** | Policy/job deferred. |

#### Calendar rules (§8)

| Item | Status | Notes |
|------|--------|--------|
| §8.1 Trainer unified projection + chips | **Done** | Occurrences in range; counts; scheduled row hidden when `liveSessionId` matches an in-range runtime session (`trainer-unified-calendar.ts`). |
| §8.1 Dedup coach vs live | **Done** | `coach_instance` rows with `trainer_live_session_id` in the live session set are skipped when merging per-client events. |
| §8.2 Client HUD: pending + accepted | **Done** | Pending, accepted, and waitlisted shown; waitlisted styled distinctly (P2). |
| Client **accept** blocked on **client-side** schedule conflict | **Not implemented** | `trainer_live_schedule_invite_accept` enforces capacity/waitlist only; does not call coach overlap rules. Trainer-side scheduling uses `findCoachScheduleConflictsForTrainer`. |

#### Other gaps / follow-ups

- **PATCH occurrence** supports time/status only — **not** add/remove invitees (design sketch allowed “adjust invitees”).
- **`trainer_live_schedule_invite_accept`** only transitions from **`pending`** to accepted/waitlisted; it does **not** treat **`waitlisted`** as re-entrant. Any UI that POSTs accept for an already-waitlisted invite will receive an error until the RPC is extended (if product wants “confirm stay on waitlist”).
- **§11.3 Recording consent** — still product/legal owned; no full audit implementation called out here.
- **§11.4 Single transaction** — occurrence + invite inserts are implemented in application code with cleanup on failure; confirm strict **single DB transaction** if compliance requires it (may differ per code path).

---

## 11. Decisions (resolved)

### 11.1 Capacity and waitlist

- **Runtime class capacity:** **6** concurrent clients per live session **for now**; treat as a **configurable** value in code/schema so it can change without a redesign.
- **Scheduled invites vs capacity:** Trainers may invite **more** people than can join the room at once. When the number of **accepted** invitees would exceed class capacity, additional acceptances go to a **waitlist**.
- **Waitlist size:** **20% of configured class capacity** (same `class_capacity` knob as above). Example: capacity **6** → waitlist slots = ⌈6 × 0.2⌉ = **2** (or equivalent rounding rule fixed in implementation). If capacity changes to 10 → waitlist slots = **2**.

### 11.2 Timezone

- **Confirmed:** Occurrences are stored as **UTC** (`timestamptz`); **display** uses trainer and client **profile timezones** (consistent with existing calendar timezone behavior).

### 11.3 Legal / compliance

- **Recording consent** for scheduled group classes (and related notices) is **owned by product/legal**; engineering surfaces consent UI and audit fields as specified by that team.

### 11.4 Idempotency — roster + live invite creation

- **Confirmed:** Create **`roster_invitations`** row and **`trainer_live_session_invites`** (and any bridge fields) in **one database transaction** — **not** a multi-step saga with separate retries between the two. Use a single transactional boundary so partial creates cannot strand users.

---

## 12. References (code)

| Area | File |
|------|------|
| Unified calendar payload | [`apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts`](apps/app/src/lib/supabase/admin/trainer-unified-calendar.ts) |
| Scheduled live admin (create/series/patch, conflicts) | [`apps/app/src/lib/supabase/admin/trainer-live-scheduled.ts`](apps/app/src/lib/supabase/admin/trainer-live-scheduled.ts) |
| Per-client calendar + coach/live/scheduled conflicts | [`apps/app/src/lib/supabase/admin/trainer-client-calendar.ts`](apps/app/src/lib/supabase/admin/trainer-client-calendar.ts) |
| HUD scheduled live client feed | [`apps/app/src/lib/supabase/client/live-scheduled-calendar.ts`](apps/app/src/lib/supabase/client/live-scheduled-calendar.ts) |
| `.ics` export | [`apps/app/src/lib/ics-export.ts`](apps/app/src/lib/ics-export.ts) |
| Reminder cron sender | [`apps/app/src/lib/supabase/admin/live-schedule-reminders.ts`](apps/app/src/lib/supabase/admin/live-schedule-reminders.ts), [`apps/app/src/pages/api/cron/scheduled-live-reminders.ts`](apps/app/src/pages/api/cron/scheduled-live-reminders.ts) |
| P2 migration (reminders + decline/promote) | [`supabase/migrations/20260406180000_trainer_live_schedule_p2_reminders_waitlist.sql`](supabase/migrations/20260406180000_trainer_live_schedule_p2_reminders_waitlist.sql) |
| Roster invite API | [`apps/app/src/pages/api/trainer/roster/invite.ts`](apps/app/src/pages/api/trainer/roster/invite.ts) |
| Roster invite email | [`apps/app/src/lib/supabase/admin/roster-invite-delivery.ts`](apps/app/src/lib/supabase/admin/roster-invite-delivery.ts) |
| Welcome trainer display | [`apps/app/src/pages/api/welcome/trainer-display.ts`](apps/app/src/pages/api/welcome/trainer-display.ts) |
| Live session schema | [`supabase/migrations/20260430113000_trainer_live_video.sql`](supabase/migrations/20260430113000_trainer_live_video.sql) |
