# Roadmap: Custom host / trainer / studio landing page

## Context

- **Current redirect surface:** `hiitworkouttimer.com` is used as a Supabase auth redirect / marketing entry. Roster invites and email verification often **do not** land users on Mission Control with `?invite=` intact, which blocks a smooth “accept invite → enrolled” path unless users later hit the main app and session-based acceptance runs.
- **Goal:** A **branded, per–host/trainer/studio** landing experience that owns **post-email** moments: verify, invite deep links, lightweight schedule/calendar preview, and clear CTAs into the product.

This doc is a **basic wireframe + phased roadmap**, not a final spec.

---

## Objectives

1. **Trust & context:** Visitor immediately sees *who* invited them (name, photo, studio brand) and *what* happens next.
2. **Auth alignment:** Email verification and magic-link landings resolve on a URL that **preserves invite context** (token or server-side lookup) and sets session on the **correct app origin** (cookie domain already documented for `.hiitworkouttimer.com`).
3. **Utility:** Logged-in invitees can see **relevant calendar / next sessions** without navigating Mission Control as a trainer.
4. **Extensibility:** Same shell supports **host (friends)**, **trainer (clients)**, and **studio** (multi-coach brand) with progressive branding depth.

---

## Personas & variants

| Variant        | Primary visitor              | Landing emphasis                                      |
| -------------- | ---------------------------- | ----------------------------------------------------- |
| **Host**       | Friend                       | Buddy link, simple CTA, optional “your host” card     |
| **Trainer**    | Client                       | Programs enrolled, schedule, messaging tone “your coach” |
| **Studio**     | Client of a specific coach   | Studio logo + coach card; future: studio-wide calendar |

**MVP:** Single layout with **dynamic hero** (host vs trainer vs studio) driven by metadata (profile + optional `studio_id` / brand fields when they exist).

---

## Wireframe (conceptual blocks)

ASCII layout — desktop-first; stack on mobile.

```
┌─────────────────────────────────────────────────────────────────┐
│  [ Studio logo optional ]     [ Host | Trainer name + avatar ]   │
├─────────────────────────────────────────────────────────────────┤
│  HERO                                                             │
│  “You’re invited by {Name}” / “Verify your email for {Studio}”   │
│  Short subcopy (1–2 lines)                                        │
│  [ Primary CTA: Open app / Continue / Accept invitation ]         │
│  [ Secondary: Sign in ]                                             │
├─────────────────────────────────────────────────────────────────┤
│  STATUS STRIP (context-aware)                                     │
│  • Not signed in → “Sign in with the email we invited.”           │
│  • Signed in, pending invite → “Finishing setup…” / success       │
│  • Error → friendly message + support link                        │
├─────────────────────────────────────────────────────────────────┤
│  CALENDAR / SCHEDULE PREVIEW (authenticated only, MVP: simple)    │
│  • Next 7 days or “Your next session” cards                         │
│  • Empty state → CTA to open full app                               │
├─────────────────────────────────────────────────────────────────┤
│  FOOTER                                                           │
│  Legal, privacy, “Wrong person?” / sign out                         │
└─────────────────────────────────────────────────────────────────┘
```

**URL patterns (illustrative — finalize with routing):**

- `/welcome` or `/i/{publicSlug}` — branded landing; query `?invite=` or server session for pending accept.
- `/verify` — ideally **not** only Supabase hosted; **app-controlled** page that reads hash/query and calls `setSession` then redirects to `/welcome` or app home (depends on auth architecture).

---

## Phased roadmap

### Phase 0 — Foundations (no new UI yet)

- Document **canonical app URL** vs **marketing URL** (`hiitworkouttimer.com`): Supabase **Site URL**, **Redirect URL allow list**, and `PUBLIC_APP_URL` must agree so `redirectTo` from `inviteUserByEmail` is allowed and lands on a page that can run **invite accept** logic.
- Confirm **cookie domain** (`PUBLIC_AUTH_COOKIE_DOMAIN`) so session set on apex or `app.` is visible where the API runs.

**Done when:** Runbook is in [AUTH_ENV_AND_REDIRECTS.md — Roster invites, email verification, and redirect alignment](AUTH_ENV_AND_REDIRECTS.md#roster-invites-email-verification-and-redirect-alignment) (Supabase checklist, `PUBLIC_APP_URL`, cookie domain, verification vs DB status, smoke test).

### Phase 1 — Minimal branded landing (MVP)

- Static or lightly dynamic page on **allowed redirect host** (subdomain of hiitworkouttimer.com or path on app).
- **Query/session:** Preserve `invite` token in URL through redirect where possible; complement with existing **`/api/invitations/accept-pending`** when token is lost.
- **Content:** Inviter display name + avatar (public or signed URL), one primary CTA to **open app** (home `/` after accept; optional Mission Control link for staff).
- **No** full calendar yet — optional “Open schedule in app” link.

**Exit:** New invitees who verify email see branded page and reach enrolled state without trainer manual cleanup.

**Done when:** `/welcome?invite=` is allowlisted in Supabase; `buildRosterInviteAcceptUrl` targets `/welcome`; invite emails and copied invite links land on the welcome page; `GET /api/invitations/preview` and `POST /api/invitations/accept` (or `accept-pending`) complete enrollment for **client** invitees without visiting Mission Control. See [AUTH_ENV_AND_REDIRECTS.md — Roster invites](AUTH_ENV_AND_REDIRECTS.md#roster-invites-email-verification-and-redirect-alignment).

### Phase 2 — Authenticated strip + schedule preview

- After `setSession`, show **read-only** next events (reuse existing calendar/APIs or a thin BFF endpoint scoped to invitee).
- Empty and error states.

**Exit:** Invitees see “what’s next” without opening Mission Control.

**Done when:** Signed-in visitors on `/welcome` see a **status strip** during invite load / sign-in / finishing acceptance / errors; **Next 7 days** shows a read-only list of upcoming **scheduled** events from the unified calendar pipeline (`loadProgramsForCalendar`, `getLoggedDatesForCalendar`, `getUnifiedCalendarEvents`) with **empty** and **retry-on-error** states; no Mission Control or new BFF required for the preview.

### Phase 3 — Studio mode

- **Studio** entity: logo, colors, copy; **trainer** nested under studio on the same template.
- Optional **vanity path** `/s/{studioSlug}/i/{inviteToken}` for shareable links.

**Exit:** Studios white-label the top of the funnel; trainers inherit studio brand.

**Done when:** Migration `studios` + `profiles.studio_id` is applied; at least one test studio row exists and a trainer profile has `studio_id` set (SQL in Supabase SQL Editor or service-role path—there is no Mission Control studio CRUD in v1). Create and resend roster invites return the vanity `inviteUrl` when the studio has a slug; Auth email `redirectTo` matches that same absolute URL (`trySendRosterInviteEmail` passes `inviteUrl`). `GET /api/invitations/preview` includes a `studio` object when applicable; `/welcome` and `/s/.../i/...` render studio header + coach copy and accent styling. Supabase **Redirect URLs** allowlist covers `/s/**` (or equivalent) on the hub origin—see [AUTH_ENV_AND_REDIRECTS.md §3](AUTH_ENV_AND_REDIRECTS.md#supabase-redirect-urls).

**Trainer + studio setup (v1):** Insert a row into `public.studios` (valid `slug` per DB `CHECK`, `display_name`, optional `logo_url`, `primary_color`, `welcome_tagline`). Set `profiles.studio_id` for the trainer to that studio’s `id`. Only the service role or an admin workflow should assign `studio_id` until ownership rules exist.

### Phase 4 — Polish & growth

- SEO-safe marketing copy, testimonials slot, optional **language** toggle.
- Analytics events: `landing_view`, `cta_open_app`, `invite_accept_success`, `calendar_preview_view`.
- A/B-friendly hero variants.

**Done when:** `FUNNEL_EVENTS` includes the four welcome events and they fire from [`WelcomeInviteLanding`](apps/app/src/components/react/WelcomeInviteLanding.tsx) / [`WelcomeSchedulePreview`](apps/app/src/components/react/WelcomeSchedulePreview.tsx) with `app_id` `app`. `/welcome` has crawl-safe title, description, and canonical URL; vanity invite URLs under `/s/.../i/...` send `noindex, nofollow`. Footer on the welcome island includes Privacy, Terms, EN/ES toggle, and wrong-person sign-out when signed in. Optional testimonials prop and `?welcome_ab=a|b` hero copy variants are available without changing invite APIs.

---

## Dependencies & risks

| Dependency              | Notes                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Supabase redirect allow list | Every `redirectTo` prefix must be listed.                          |
| `PUBLIC_APP_URL`        | Must match production app used for API cookies and deep links.      |
| Public inviter profile  | Need safe fields (name, avatar); avoid leaking email/phone on page.  |
| RLS / APIs for calendar | Preview endpoints must scope to **current user** only.              |

**Risks:** Marketing site and app on different origins without shared cookies → session not visible to app APIs; fix with documented cookie domain + consistent redirect targets.

---

## Success metrics (lightweight)

- **Invite acceptance rate** within 24h of email send (before/after Phase 1).
- **Support tickets** “I accepted but still pending” (should drop after Phase 0–1).
- **Time to first app open** from verify (analytics).

---

## Out of scope (for later)

- Full scheduling/editing on the landing page.
- Payments or contracts on first landing.
- Replacing Supabase-managed email entirely (can still use Supabase for delivery with custom `redirectTo`).

---

## Related repo docs

- `docs/AUTH_ENV_AND_REDIRECTS.md` — env and redirect configuration.
- `docs/AMRAP_CUSTOM_DOMAIN_DEPLOYMENT.md` — domain / cookie patterns.
- `docs/PHASE_5_ADVANCED_CALENDAR_ROADMAP.md` — calendar direction if preview deepens.

---

*Last updated: 2026-03-28 — basic wireframe + roadmap; iterate as product scope firms.*
