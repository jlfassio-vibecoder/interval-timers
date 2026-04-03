# Technical Design: Trainer Live P4 — Long sessions, token renewal, metrics, max duration

**Status:** Design only — **not implemented** until this document is reviewed and approved.  
**Parent:** [TRAINER_VIDEO_SESSION_TDD.md](./TRAINER_VIDEO_SESSION_TDD.md).  
**Baseline:** [`apps/app/src/pages/api/trainer-live/agora-token.ts`](../apps/app/src/pages/api/trainer-live/agora-token.ts) (`EXPIRY_SEC = 3600`, body `{ token }`); [`useTrainerLiveAgoraChannel`](../apps/app/src/hooks/useTrainerLiveAgoraChannel.ts) (join once, no renewal); [`getTrainerLiveToken`](../apps/app/src/lib/trainer-live/agora.ts).

---

## 1. Purpose

- **Token refresh:** Keep Trainer Live calls connected beyond the Agora token TTL by renewing before expiry (Agora Web SDK NG `token-privilege-will-expire` + `renewToken`).
- **Metrics:** Emit a small, consistent set of product events for funnel and quality analysis.
- **Max session duration (optional):** Cap wall-clock room lifetime for support and abuse control without relying on trainers to click “End for everyone.”

---

## 2. Token API contract

**Today:** `GET /api/trainer-live/agora-token?channel=&account=` → `200` `{ "token": "<string>" }`.

**P4:** Same endpoint, extended JSON:

```json
{
  "token": "<string>",
  "expires_at": 1712073600
}
```

- **`expires_at`:** Unix timestamp (seconds, UTC) when the minted token expires — computed server-side as `floor(now_utc) + EXPIRY_SEC` so client and server share one source of truth.
- **Backward compatibility:** Clients that only read `token` keep working; [`getTrainerLiveToken`](../apps/app/src/lib/trainer-live/agora.ts) should parse optional `expires_at` and expose it in `TrainerLiveTokenResult` for the hook.

**Renewal path:** Each token fetch (initial join and every renewal) runs the **same** Supabase checks: participant row exists for `(session_id, id)` and session `status = 'active'`. Optionally add **max duration** check (§4) before minting.

**TTL (`EXPIRY_SEC`):** Keep **3600** initially unless product needs longer single tokens; renewal allows indefinite *Agora* connectivity subject to **max session** policy. Document Agora’s maximum privilege duration if raising `EXPIRY_SEC`.

**Production:** Any duplicate route (e.g. future root Vercel handler) must return the **same** JSON shape.

---

## 3. Client: `useTrainerLiveAgoraChannel`

After successful `client.join`:

1. Register `client.on('token-privilege-will-expire', async () => { ... })`:
   - Call `getTrainerLiveToken(channelName, participantId)`.
   - On success: `await client.renewToken(token)`.
   - On failure: set error state / user-visible message; optional retry with backoff.
2. Optionally register `token-privilege-did-expire` to attempt one re-fetch + `renewToken` or controlled `leave` + user prompt (prefer avoiding expiry via §2).
3. **Cleanup:** Remove listeners on effect teardown / `leave`.

**Concurrency:** Ignore overlapping renewals (simple `renewInFlight` ref) to avoid duplicate fetches.

**Analytics (optional):** On successful renewal, fire `trainer_live_token_renewed` (see §5) — throttle to avoid noise if SDK fires more than expected.

Reference: [Agora token authentication](https://docs.agora.io/en/video-calling/develop/authentication-workflow).

---

## 4. Optional max session duration

**Primary enforcement (recommended):** **Token endpoint** — before building the token, if the session has exceeded its allowed wall-clock lifetime, return **403** with a stable `error` string (e.g. `Session time limit reached`) so clients can show copy and stop renewal loops.

**Secondary (optional):** Scheduled job or Edge function that calls `trainer_live_end_session` at cap — improves UX (everyone dropped cleanly) but does not replace token denial for edge cases.

**Schema (v1 recommendation):**

- Add nullable **`session_cap_at timestamptz`** on `trainer_live_sessions`, set in `trainer_live_create_session` as `now() + interval 'N minutes'` where **N** comes from env (e.g. `TRAINER_LIVE_MAX_SESSION_MINUTES`) or a single product constant in the RPC. **No** per-session trainer override in v1 unless product explicitly requires it later.
- Alternative without migration: compare `now()` to `created_at + interval` in the token route only (constant in server code). Prefer **`session_cap_at`** if ops need to adjust per environment without redeploying SQL literals in multiple places.

**Interaction with renewal:** Renewing the token **does not** extend `session_cap_at`; it only refreshes Agora credentials while the session remains active and under cap.

**RPC `trainer_live_end_session`:** Unchanged; cap is independent of manual end.

---

## 5. Metrics (product analytics)

**Transport:** [`trackEvent` from `@interval-timers/analytics`](../packages/analytics/src/track.ts) with `supabase` from the app.

**Critical implementation note:** `trackEvent` only records events whose names appear in **`FUNNEL_EVENTS`**. New names **must** be added to that allowlist in [`packages/analytics/src/track.ts`](../packages/analytics/src/track.ts) or calls are dropped (dev: `console.warn` for unknown event). P4 implementation PR extends `FUNNEL_EVENTS` with the names below.

**Proposed events and properties**

| Event name | When | Properties (suggested) |
|------------|------|-------------------------|
| `trainer_live_session_created` | After successful `trainer_live_create_session` (lobby or roster) | `shell` (string) |
| `trainer_live_join_succeeded` | After join RPC returns `participant_id` | `shell` (from hints if known), `requires_invited_account` (boolean) |
| `trainer_live_join_failed` | Join RPC error | `error_code` or short `reason` enum (not raw SQL text) |
| `trainer_live_left` | User leaves room (toolbar leave, not necessarily tab close) | `role` (`trainer` \| `client`) |
| `trainer_live_session_ended_by_host` | Host “End for everyone” succeeds | none or `shell` |
| `trainer_live_token_renewed` | After successful `renewToken` (optional) | none |

**Privacy:** Do **not** send `invited_client_user_id` or raw join hints UUIDs. Session id: prefer **omitting** or using a short hash if funnels require correlation — default **omit** in v1.

**App id:** Pass `appId: 'app'` (or existing Mission Control convention) in `trackEvent` options where supported.

**StrictMode / double mount:** Use a ref guard for “once per logical action” if effects would duplicate events; document in implementation.

---

## 6. Security (P4)

- Renewal uses the **same** token route and DB validation as initial join — no relaxed token.
- **Rate limiting** the token endpoint (per IP or per `account` UUID) is **P4.1** follow-up; note in [TRAINER_VIDEO_SESSION_TDD.md](./TRAINER_VIDEO_SESSION_TDD.md) §10.

---

## 7. Testing matrix (implementation PR)

- Short TTL in dev (temporarily lower `EXPIRY_SEC` or use Agora test project): confirm `token-privilege-will-expire` fires and channel survives after `renewToken`.
- Token **403** when session `ended` or past `session_cap_at` (if implemented).
- Join with expired session shows user-visible error.
- Metrics: verify rows in `analytics_events` for each event after allowlist update; no duplicate fires on strict double mount where guarded.

---

## 8. Implementation checklist (post-approval)

1. API: add `expires_at` to trainer-live agora-token response; optional cap check + 403.
2. Migration (if using `session_cap_at`): column + set in `trainer_live_create_session`.
3. [`agora.ts`](../apps/app/src/lib/trainer-live/agora.ts): extend `TrainerLiveTokenResult` with optional `expiresAtSec`.
4. [`useTrainerLiveAgoraChannel.ts`](../apps/app/src/hooks/useTrainerLiveAgoraChannel.ts): listeners + `renewToken`; cleanup.
5. UI: banner when token fails due to time limit or session ended mid-call.
6. [`FUNNEL_EVENTS`](../packages/analytics/src/track.ts) + `trackEvent` calls in lobby, join, host leave/end.
7. [COMMANDS.md](./COMMANDS.md): one line on P4 (expiry field, optional migration).
8. Update parent TDD §9 P4 row to **complete** when shipped.

---

## 9. Out of scope (P4)

- Agora cloud recording, billing, or usage dashboards.
- Replacing `PageViewTracker` (keep as-is for path-level analytics).
- AMRAP token route changes (separate product).

---

## 10. Summary

P4 adds **server-announced token expiry**, **client `renewToken` on privilege-will-expire**, optional **`session_cap_at` / max duration** enforced at token issuance, and **allowlisted `trackEvent` names** for Trainer Live lifecycle — without weakening participant/session checks.
