# Communications System — Technical Design Document

**Status:** Draft  
**Scope:** Refactor `apps/comms` (Google AI Studio / Firebase prototype) into a first-class communications subsystem for **interval-timers**, backed by **Supabase** (Postgres + Auth + Realtime), integrated with **studios**, **trainers**, and **clients**.

---

## 1. Goals

| Goal | Description |
|------|-------------|
| **Native integration** | Live inside the main product (`apps/app`) with shared auth, design tokens, and navigation—not a standalone Firebase app. |
| **Supabase as source of truth** | Messages, threads, membership, and read state in Postgres; **Row Level Security (RLS)** for authorization; **Realtime** for live updates. |
| **Relationship-aware messaging** | Support conversations aligned to real product relationships: **studio ↔ trainers**, **trainer ↔ client**, and **peer** (trainer–trainer, client–client) where policy allows. |
| **Replace Firebase** | Remove Firebase Auth, Firestore, and Storage from the comms surface; use Supabase Auth and storage patterns already used elsewhere in the monorepo. |

### 1.1 Non-goals (initial phases)

- End-to-end encryption of message bodies.
- Full parity with Slack/Discord (infinite public channels, bots, workflows).
- SMS or push notifications (can be a later phase; design hooks only).
- Porting the AI Studio app’s **Kanban / task board** into v1 of comms (optional follow-up; see §8).

---

## 2. Current state

### 2.1 Prototype (`apps/comms`)

- **Stack:** Vite + React 19, Tailwind, Firebase (Auth, Firestore, Storage).
- **Features:** Department-like “channels,” global message stream, threaded replies, notifications collection, optional Gemini in task modal, Kanban tasks.
- **Identity:** Firebase UID; admin hardcoded by email in app code (not acceptable long-term).
- **Repo:** Nested under `apps/comms/`, **not** listed in root `package.json` workspaces; treated as an import/copy for refactor.

### 2.2 Platform context (this repo)

- **`apps/app`:** Astro + React, Supabase (`@supabase/supabase-js`, SSR patterns), `profiles` with `role` (`client` | `trainer` | `admin`).
- **`public.studios`:** Studio branding/org; `profiles.studio_id` and **`trainers.studio_id`** link coaches to a studio.
- **`public.trainers`:** One row per coach (`user_id` → `profiles`), branding fields, optional `studio_id`.
- **`public.client_coach_assignments`:** Trainer–client assignment rows (program/workout/WOD)—strong signal for **who may message whom** for coach–client flows.
- **Realtime precedent:** `postgres_changes` subscriptions (e.g. `useHUDRealtime.ts`, trainer live sessions)—same pattern should apply to messages.

### 2.3 Related apps

- **`apps/trainer-chat`:** Agora-based **video**; name overlap only—comms text should not be confused with live video. Clear naming (e.g. “Messages” vs “Live”) in UI.

---

## 3. Product model

### 3.1 Conversation types

Use a small, explicit set of **conversation kinds** so RLS and UI can stay understandable:

| Kind | Typical participants | Purpose |
|------|----------------------|---------|
| `studio_team` | All trainers with `trainers.studio_id = X`, optional studio owner/admin | Studio ↔ trainers announcements and team discussion. |
| `direct` | Exactly two `profiles.id` | Trainer–client (when assignment exists), trainer–trainer, client–client, or studio staff ↔ trainer as needed. |
| `group` | N users, optional `studio_id` anchor | Ad-hoc or named groups (e.g. “Front desk + coach”). |

**Rules (product policy, enforced in DB/app):**

- **Trainer ↔ client:** Allow opening or continuing a direct thread only if a **non-revoked** `client_coach_assignments` row exists for `(trainer_user_id, client_user_id)` *or* an explicit future “messaging opt-in” table (if product allows messaging before assignment).
- **Studio ↔ trainers:** Membership in `studio_team` conversations derived from `trainers.studio_id` (and later studio **owner** / **admin** roles if added).
- **Peer (trainer–trainer, client–client):** Allowed only when both users share a **studio scope** or **explicit relationship** (e.g. same `studio_id`, or both in same roster). Exact rule should be configurable; v1 can restrict **client–client** to same studio or disable until policy is defined.

### 3.2 Channels vs threads

- **v1 recommendation:** **Conversation-centric** model (direct + group + one studio team feed per studio), with **thread replies** as optional child rows or a `reply_to_message_id` on `messages`.
- Avoid copying the prototype’s “department channel” list as the only navigation; map **studio** and **relationships** from Supabase instead.

---

## 4. Architecture

### 4.1 High-level

```
┌─────────────────────────────────────────────────────────────┐
│ apps/app (Astro + React)                                     │
│  Routes: /messages, /trainer/... , embeds in Mission Control │
│  UI: inbox, thread, composer, attachments                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Optional shared package: packages/comms-ui or packages/     │
│ handoff extension — only if reuse across apps is needed      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase                                                     │
│  Postgres: conversations, participants, messages, reads      │
│  RLS: per conversation membership                            │
│  Realtime: postgres_changes on messages (filtered)           │
│  Storage: message attachments (private bucket + RLS policies)│
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Embedding strategy

- **Primary:** Routes and React islands inside **`apps/app`** so sessions, cookies, and Supabase clients match the rest of the product.
- **Secondary:** If a separate deployable is ever needed, consume the same API and RLS via Supabase client from a thin shell—**do not** fork business logic.

---

## 5. Data model (proposed)

All names are illustrative; finalize in migrations.

### 5.1 Core tables

**`conversations`**

- `id` (uuid, PK)  
- `kind` (`studio_team` | `direct` | `group`)  
- `studio_id` (uuid, nullable, FK → `studios`) — set for studio-scoped threads  
- `title` (text, nullable) — for groups / studio feed label  
- `created_by` (uuid, FK → `auth.users`)  
- `created_at`, `updated_at`  
- **Constraint:** `kind = 'direct'` ⇒ enforce exactly two participants in app/trigger or defer to participant count check.

**`conversation_participants`**

- `conversation_id` (uuid, FK)  
- `user_id` (uuid, FK → `auth.users` / `profiles.id`)  
- `role` (optional: `owner` | `member` | `admin`)  
- `joined_at`, `last_read_at` (for unread counts)  
- `muted_until` (optional)  
- PK: `(conversation_id, user_id)`

**`messages`**

- `id` (uuid, PK)  
- `conversation_id` (uuid, FK)  
- `sender_id` (uuid, FK → `auth.users`)  
- `body` (text) — or `content_json` if rich text is required later  
- `reply_to_message_id` (uuid, nullable, self-FK)  
- `created_at`, `edited_at` (nullable)  
- `deleted_at` (nullable, soft delete)

**`message_attachments`** (optional v1 or v1.1)

- `id`, `message_id`, `storage_path`, `mime_type`, `size_bytes`, `created_at`  
- Files in **Supabase Storage** private bucket; download via signed URLs or RLS-scoped policies consistent with message access.

### 5.2 Indexing

- `messages (conversation_id, created_at desc)` for pagination.  
- `conversation_participants (user_id)` for “my conversations” list.

### 5.3 Derived / materialized (optional)

- Unread counts: compute from `messages.created_at` vs `conversation_participants.last_read_at` or maintain a small `conversation_user_state` row—trade-off between simplicity and write amplification.

---

## 6. Authorization (RLS)

Principles:

1. **No global message read.** Users only read messages for `conversation_id`s they participate in.  
2. **Insert:** `sender_id = auth.uid()` and sender is a participant.  
3. **Studio team conversations:** Insert/select only if `trainers.studio_id` matches conversation’s `studio_id` (for trainers); studio **owner** role may require a new `studio_members` table if not modeled yet—**flag for schema follow-up**.  
4. **Direct trainer–client:** Insert first message or create conversation only if allowed by `client_coach_assignments` (or policy table)—implement via **SECURITY DEFINER** RPCs (e.g. `create_direct_conversation(target_user_id uuid)`) to centralize rules.  
5. **Admin:** `profiles.role = 'admin'` may read for support; scope narrowly and audit (optional).

Prefer **RPCs for mutations** that create conversations or add participants, keeping RLS on `messages` simple.

---

## 7. Realtime and performance

- Subscribe to **`messages`** inserts (and updates if edits) filtered by `conversation_id IN (...)` for open threads, or use **one channel per conversation** when a thread is open (matches existing `trainer-live-*` channel pattern).  
- **Pagination:** Cursor-based (`created_at`, `id`).  
- **Rate limiting:** Consider Edge Function or Postgres constraints on burst inserts per user to reduce abuse.

---

## 8. Relationship to prototype features

| Prototype feature | Direction |
|-------------------|-----------|
| Firebase Auth | **Remove**; use Supabase session from `apps/app`. |
| Firestore collections | **Replace** with tables above. |
| Thread replies / notifications | **Recreate** with `reply_to_message_id` + optional `notifications` table or reuse in-app toast + badge only. |
| Kanban / tasks / templates | **Out of scope for comms v1** unless product ties tasks to assignments; could become a separate “Mission Control tasks” module using same `trainer_id` / `studio_id`. |
| Gemini in task modal | **Not ported** with tasks; if AI assists **message draft** later, use existing Vertex/genai patterns from `apps/app` behind a feature flag. |
| Department “channels” | **Replace** with studio + conversation kinds driven by Supabase. |

---

## 9. UX and surfaces

- **Trainer (Mission Control):** Inbox, studio team, per-client threads; deep link from client roster row (“Message”).  
- **Client:** Inbox, threads with assigned coach(es); hide studio-internal threads.  
- **Studio admin / owner (future):** Moderation tools, archive studio feed—depends on studio membership model.  
- **Consistency:** Reuse `apps/app` layout, typography, and `@interval-timers/auth-ui` / design system where applicable.

---

## 10. Implementation phases

### Phase 0 — Repository hygiene

- Add `apps/comms` to **workspaces** or **delete nested `.git`** and treat as source-only until replaced.  
- Align package name (`react-example` → `@interval-timers/comms-legacy` or archive folder).

### Phase 1 — Schema + RLS

- Migrations under `supabase/migrations/` (single source of truth with `apps/app` if duplicated—follow existing project convention).  
- RLS policies + RPCs for creating conversations.  
- Seed or migration tests for policy matrix (trainer/client/studio).

### Phase 2 — API layer in `apps/app`

- Server helpers or thin wrappers: list conversations, fetch history, send message, mark read.  
- Type generation: extend `Database` types (`apps/app/src/types/supabase.ts` or generated).

### Phase 3 — UI

- Inbox + thread view (React).  
- Realtime subscription hook (pattern from `useHUDRealtime.ts`).  
- Composer with attachment upload if in scope.

### Phase 4 — Integration

- Links from roster, assignments, and studio dashboard.  
- Optional email/push (future).

### Phase 5 — Decommission prototype

- Remove unused Firebase config from repo or keep only as archived reference.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| RLS complexity for studio membership | Start with RPCs + minimal policies; add `studio_members` if owners/admins are not yet first-class. |
| Realtime connection limits | Subscribe only to active conversation; paginate history. |
| Client–client messaging abuse | Default **off** or studio-scoped; moderation hooks. |
| Duplicate migration paths (`apps/app/supabase` vs root `supabase`) | Follow one canonical migration path per team convention before merging. |

---

## 12. Open questions

1. **Studio ownership:** Is there a `studio_owners` / `studio_members` table planned, or is `trainers.studio_id` the only org link for v1?  
2. **Client–client messaging:** Required at launch or later?  
3. **Message retention / legal:** Export and deletion for GDPR-style requests.  
4. **Attachments:** Required in v1 or fast-follow?  
5. **Search:** Full-text search in Postgres (`tsvector`) vs defer?

---

## 13. Success criteria

- Trainers and clients can exchange messages only where policy allows (assignments + studio rules).  
- Studio-scoped team conversation exists without Firebase.  
- No duplicate login; session is the main app’s Supabase session.  
- Realtime delivery matches or exceeds prototype perceived latency for active threads.  
- Security review: RLS tests pass for negative cases (cross-user peek).

---

*Document version: 1.0 — Draft for engineering and product review.*
