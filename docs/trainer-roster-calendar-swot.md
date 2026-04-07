# SWOT: Trainer Roster — Performance Lab Calendar

**Scope:** The **Calendar** tab in Mission Control when a coach opens a client from the roster (`/roster/:userId/lab` → **Calendar**). This covers the UI in `PerformanceLabCalendarSection.tsx`, the trainer calendar service layer (`trainer-client-calendar.ts`), and the HTTP routes under `/api/trainer/clients/[userId]/calendar` (including schedule instance create/patch). It does **not** include the end-client HUD calendars (`ScheduleZone`, `AppCalendar`), except where shared primitives apply (for example `getCalendarEventsForRange` in `calendar-events.ts`).

**Date:** 2026-04-06

---

## Strengths

1. **Single pane for three signal types** — The week grid combines program-derived workouts (read-only), emerald “week board” activities (aligned with the **Week** tab), and orange coach schedule instances. That gives coaches context without switching tools.

2. **Roster-first authorization** — Calendar payload and mutations are gated by `isUserInViewerRoster`; instance patch/create further verify `client_user_id`, `trainer_user_id`, and active assignments (`revoked_at` / `dismissed_at`). Wrong clients or cross-trainer access are rejected consistently with a 404-style posture where appropriate.

3. **Actionable coach scheduling** — `@dnd-kit` drag-and-drop reschedules coach instances with an 8px activation distance, which reduces accidental drags. Adding instances uses a clear assignment dropdown plus per-weekday buttons.

4. **Server-side guardrails** — `validateCalendarRange` enforces `YYYY-MM-DD`, real calendar dates, ordering, and a **93-day** maximum span, limiting abuse and heavy queries.

5. **Efficient data loading on the server** — Program titles and `program_weeks` are loaded in batched queries rather than per-enrollment N+1 patterns. The GET handler composes program events, logs, and instances in one payload.

6. **Honest UX copy** — Inline help explains read-only program rows, emerald pills, UTC midday storage for chosen dates, and how to add instances. That sets expectations for support and power users.

7. **Shared program calendar logic** — Program events reuse `getCalendarEventsForRange` and completion keys from `user_workout_logs`, so trainer view stays consistent with how program days and completion are modeled elsewhere.

---

## Weaknesses

1. **UTC-centric week vs “Client TZ” label** — The grid’s Monday boundary and day columns are driven by UTC date math (`mondayOfWeekUtc`, `addDaysIso`), while the header shows the client’s profile timezone. Coaches may expect the week to match the client’s local week; the UI does not fully commit to either model, which can cause subtle confusion.

2. **Fixed UTC noon for coach placement** — New and moved instances use `T12:00:00.000Z` for the selected calendar day. That is documented, but for clients far from UTC it can still feel arbitrary or collide with how the client app displays “the same” local day.

3. **Crude error surfacing** — Failed reschedule/create paths use `window.alert`. That works but is disjoint from the rest of the Mission Control UI and is poor for accessibility and mobile.

4. **No delete path for coach instances** — *Mitigated (2026-04-06):* `DELETE /api/trainer/clients/[userId]/calendar/instances/[instanceId]` and the Performance Lab calendar pencil modal include **Delete instance** (with confirm). Coaches can also edit date, time, and assignment in that modal; drag still reschedules by day.

5. **Silent degradation of week-board merge** — When parallel weekly-board fetches fail, the code continues and simply omits cards for those responses. The calendar still renders, but emerald pills may disappear without an explicit error, which undermines trust in the combined view.

6. **Week-only navigation** — There is no month, agenda, or multi-week overview. Planning across enrollments or comparing distant weeks requires many next/previous clicks.

7. **Program schedule model is MVP-simple** — `getCalendarEventsForRange` maps program weeks to **consecutive calendar days** from `startDate`. Real-world programs (rest days, flexible templates, deloads) may not match that model, so the read-only program strip can misrepresent intent even when the implementation is consistent.

8. **Accessibility gaps** — Drag-only reschedule has no obvious keyboard-first alternative; information density relies on small mono text and color (orange vs emerald vs gray), which may be hard for low vision or color-deficient users without additional non-color cues.

---

## Opportunities

1. **Timezone-true week boundaries** — Compute week start/end and column labels in the client’s IANA timezone (using `Intl` or a small library), while keeping storage semantics explicit. Optionally offer a toggle: “Week starts (client local | Monday UTC).”

2. **Replace alerts with in-app feedback** — Inline banners, toasts, or field-level errors on the Calendar tab would match Performance Lab styling and improve a11y.

3. **Instance lifecycle completion** — Add DELETE (or “clear day”) for `client_coach_schedule_instances`, plus optional duplicate prevention or “merge” hints when the same assignment already has an instance that week.

4. **Richer views** — Month grid or two-week strip for planning; optional ICS export for coach-visible coach instances (program export already exists elsewhere in the product surface).

5. **Optimistic updates** — PATCH/POST success paths already reload; optimistic UI would make drag feel instant with rollback on failure.

6. **Deep links** — Clicking a program row could jump to **Programs & enrollments** or a read-only program preview; coach instances could open assignment detail.

7. **Explicit weekly-board error state** — If any `weekly-board` request fails, show a compact warning so coaches know emerald data may be incomplete.

8. **Touch-friendly affordances** — Larger drop targets, long-press to drag, or a “Move to…” menu on mobile could complement dnd-kit.

---

## Threats

1. **Timezone and date-boundary bugs** — Any future change that mixes local midnight, UTC date-only strings, and `scheduled_at` timestamptz without a single source of truth risks off-by-one-day bugs and support tickets.

2. **Divergence from program reality** — As programs gain rest days, non-linear schedules, or per-workout offsets, the consecutive-day mapper will increasingly disagree with coach and client expectations unless the model is upgraded in sync.

3. **Partial failure modes** — Calendar API success + weekly-board failure produces a plausible but wrong composite UI; coaches may act on incomplete information (e.g., missing planned activities).

4. **Security regression surface** — Roster checks are scattered across helpers and routes; a new endpoint or refactored auth helper that skips `isUserInViewerRoster` or instance ownership checks would be high severity.

5. **Competitive UX expectations** — Coaches comparing this to Google Calendar, TrueCoach, or Mindbody will expect recurrence, invites, notifications, and mobile polish; the current MVP is deliberately narrower, which can read as “missing features” rather than “focused scope.”

6. **Performance at scale** — Very large weekly-board card counts or many enrollments could make the week column scroll areas heavy; parallel fetches per unique Monday in range are bounded for a single week today but patterns should be watched if ranges expand.

---

## Summary

The roster Performance Lab Calendar is a **strong MVP** for **context + coach-driven scheduling**: it is secure, batched on the server, and combines program, board, and coach instances in one week strip. The largest gaps are **timezone semantics vs labeling**, **error and partial-failure UX**, **no delete for coach instances**, and the **simplified program-day mapping** inherited from shared calendar logic. Addressing client-local week alignment and first-class instance removal would materially reduce confusion and support load.
