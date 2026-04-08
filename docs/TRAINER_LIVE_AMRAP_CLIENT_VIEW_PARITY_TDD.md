# Technical Design: Trainer Live AMRAP — Client view parity with trainer (embed body)

**Status:** Design — implementation steps for engineering.  
**Related:** [TRAINER_LIVE_AMRAP_WRAPPER_TDD.md](./TRAINER_LIVE_AMRAP_WRAPPER_TDD.md), [TRAINER_LIVE_INTERVAL_WRAPPERS_TDD.md](./TRAINER_LIVE_INTERVAL_WRAPPERS_TDD.md), [`TrainerLiveAmrapWrapper`](../apps/app/src/lib/trainer-live/wrappers/amrap/TrainerLiveAmrapWrapper.tsx), [`AmrapSessionShell`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx), [`TrainerLiveClientJoinPage`](../apps/app/src/components/react/trainer/live/TrainerLiveClientJoinPage.tsx), [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx).

---

## 1. Purpose

Clients in a **Video + Intervals** live session (`shell = 'countdown_timer'`, `interval_wrapper_kind = 'amrap'`) should see the **same AMRAP embed presentation** as trainers: black canvas, “live session” brand line, phase title row (e.g. Setup + status line), **two metric cards** (phase timer + YOUR ROUNDS), and the **two-column exercise grid** — matching the trainer reference UI **pixel- and structure-level**.

**Explicit exclusion:** Clients do **not** get the **Mission Control host navbar** that bundles session controls (e.g. copy link, end session, start/switch interval tool, back-to-video, AMRAP host slot actions from [`TrainerLiveHostNavHeaderBar`](../apps/app/src/components/react/trainer/live/TrainerLiveHostNavHeaderBar.tsx)). Those remain trainer-only.

This document is **UI/layout parity** for the shared AMRAP shell inside Trainer Live, not a change to AMRAP engine authority (host still drives start/pause/finish via existing `useSocialAmrap` behavior).

---

## 2. Reference model (trainer)

The approved reference is the **trainer** Mission Control view for AMRAP embed:

| Region | Expected content |
|--------|------------------|
| Brand | Small uppercase accent label (e.g. live session — gold / `orange-light` family) |
| Title row | Phase title (e.g. “Setup”) + trailing subtitle (e.g. “Get into position”) |
| Metrics | Two bordered cards: phase label + time (e.g. SETUP `00:08`) and YOUR ROUNDS + count |
| Exercises | Rounded cards in a two-column grid with ordered exercises + rep badges |
| Rails | SESSION / VIDEO / CHAT side rails (already provided by [`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx)) |

Implementation today already aims at this shape in **`apps/amrap`** via `shellLayout="trainerLiveEmbed"` ([`AmrapSessionShell`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx), [`AmrapTimerDisplay`](../apps/amrap/src/components/amrap-session/AmrapTimerDisplay.tsx)).

---

## 3. Current gaps (audit)

### 3.1 Page shell — `apps/app`

| Area | Trainer ([`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx)) | Client ([`TrainerLiveClientJoinPage`](../apps/app/src/components/react/trainer/live/TrainerLiveClientJoinPage.tsx)) |
|------|--------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Viewport | `fixed inset-0` full-screen column | Centered column `max-w-5xl mx-auto` with page padding |
| Top chrome | [`TrainerLiveHostNavHeaderBar`](../apps/app/src/components/react/trainer/live/TrainerLiveHostNavHeaderBar.tsx) (live session + **host actions** + controls) | Standalone `<h1>Live session</h1>` above room; **no** host nav bar |
| Timer background context | [`TrainerLiveTimerBackgroundProvider`](../apps/app/src/contexts/TrainerLiveTimerBackgroundContext.tsx) wraps room (trainer only path) | Not mounted |

**Impact:** Clients get a **narrower** main column and a **different top treatment** than trainers, so the AMRAP embed (and rails) do not occupy the same spatial composition as the reference, even though they share `TrainerLiveSessionRoom`.

### 3.2 AMRAP wrapper — `TrainerLiveAmrapWrapper`

| Feature | Trainer | Client |
|---------|---------|--------|
| [`TrainerLiveAmrapTimerBackground`](../apps/app/src/components/react/trainer/live/TrainerLiveAmrapTimerBackground.tsx) | Yes | No |
| [`TrainerLiveTimerBackgroundMeLeaderToggle`](../apps/app/src/components/react/trainer/live/TrainerLiveTimerBackgroundMeLeaderToggle.tsx) | Yes (`embedTitleBarAccessoryBeforeSub`) | No |

**Impact:** Intentional for **video background** (trainer-only). It must **not** block parity of the **timer + rounds + exercise list** column; the reference screenshot is dominated by that column, not the blurred video layer.

### 3.3 AMRAP embed layout — `apps/amrap`

For `trainerLiveEmbed`, setup/work uses a **4-column grid** in [`AmrapTimerDisplay`](../apps/amrap/src/components/amrap-session/AmrapTimerDisplay.tsx): host controls + clock (left card), **two center columns** (optional children), rounds (right card).

- **Trainer (host):** `beforeMainClock` renders pause / skip / finish in the left card; left column is visually dense.
- **Client:** `beforeMainClock` is empty (`isHost` false); left card contains **only** the clock; **center span may be empty** depending on phase and `children` wiring in [`AmrapSessionShell`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx) (`workPhaseInTimerChildren` is generally false for embed).

**Impact:** Clients can see **different horizontal balance** (large empty gutter between timer card and rounds) versus trainers, which violates “match exactly” for the metric row.

---

## 4. Goals and non-goals

### Goals

| ID | Goal |
|----|------|
| **G1** | Client in-room **countdown_timer + AMRAP** uses the **same full-bleed (or equivalent) layout** as trainer below the client’s minimal chrome. |
| **G2** | **AMRAP embed block** (title row, dual metric cards, exercise grid) is **visually identical** for trainer and client for the same session state (modulo host-only accessories defined below). |
| **G3** | Side rails (Session / Video / Chat) and drawer behavior remain consistent with [`TrainerLiveSessionRoom`](../apps/app/src/components/react/trainer/live/TrainerLiveSessionRoom.tsx). |

### Non-goals

| ID | Non-goal |
|----|-----------|
| **NG1** | Showing **host-only** Mission Control controls on the client (copy link, end session, attach AMRAP, “Back to video”, etc.). |
| **NG2** | **Timer background video** and **Me/Leader** toggle on the client (trainer-only). |
| **NG3** | Changing **RLS**, attach RPCs, or who may start/pause/finish AMRAP (product authority unchanged). |

### Host-only UI (allowed to differ)

- [`TrainerLiveHostNavHeaderBar`](../apps/app/src/components/react/trainer/live/TrainerLiveHostNavHeaderBar.tsx) and everything in its right-side control cluster.
- [`TrainerLiveAmrapTimerBackground`](../apps/app/src/components/react/trainer/live/TrainerLiveAmrapTimerBackground.tsx) + [`TrainerLiveTimerBackgroundMeLeaderToggle`](../apps/app/src/components/react/trainer/live/TrainerLiveTimerBackgroundMeLeaderToggle.tsx).
- Pause / Skip / Finish buttons inside the embed (**today** rendered for `engine.isHost` in [`AmrapSessionShell`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx)). **Decision point:** see §8 — either keep in embed for host only (current) or relocate all host transport controls into Mission Control nav for both layouts; clients never see them either way.

---

## 5. Proposed architecture

### 5.1 Single “live session” chrome for clients (minimal)

Introduce a **client-safe** top row that **visually matches** the left side of the trainer bar (label styling, spacing, border) but **omits** `hostNavActions` and host buttons:

- **Option A (recommended):** Extract a **`TrainerLiveSessionBrandingBar`** (name illustrative) that renders the “Live session” / LIVE SESSION treatment only; **`TrainerLiveHostNavHeaderBar`** composes it + `hostNavActions` + `children` (errors, buttons).
- **Option B:** Parameterize `TrainerLiveHostNavHeaderBar` with `variant="host" | "client"` and **hide** host slots + omit right-side trainer controls when `client`.

Either way, **client join page** stops using a loose `<h1>` and uses the **same bar component** as the trainer (restricted variant).

### 5.2 Full-height room shell for client when in video session

Align client container with trainer:

- When `participantId` is set and room is ready, use a **full-screen flex column** (`min-h-0 flex-1` pattern) comparable to trainer’s `fixed inset-0` + scroll region.
- **Remove or gate** `max-w-5xl` for the **in-session** state so `TrainerLiveSessionRoom` can use the full width; optional `max-w-*` only for pre-join forms.

### 5.3 AMRAP grid: parity for non-host embed

Adjust [`AmrapTimerDisplay`](../apps/amrap/src/components/amrap-session/AmrapTimerDisplay.tsx) / [`AmrapSessionShell`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx) so that when `shellLayout === 'trainerLiveEmbed'` and **host controls are not shown**:

- The **timer card** and **rounds card** present as a **paired row** consistent with the reference (e.g. **2-column grid** or **4-column grid with collapsed center**), avoiding a wide empty center strip.
- When host controls **are** shown, preserve enough space for the control stack without breaking the client layout (or use a responsive breakpoint: stacked controls above metrics on narrow widths).

Concrete implementation approaches (pick one in build):

1. **Layout mode prop:** e.g. `embedMetricsLayout: 'hostSplit' | 'participantSplit'` derived from `engine.isHost` inside `AmrapSessionShell` and passed to `AmrapTimerDisplay`.
2. **CSS grid template:** use `subgrid` / `col-span` adjustments when `beforeMainClock` is absent so center columns collapse.

---

## 6. Implementation steps (sequenced)

### Phase 0 — Baseline and screenshots

1. Capture **trainer** and **client** side-by-side for: `waiting` (if applicable), `setup`, `work`, `finished` — same `amrap_session_id`.
2. Log **computed widths** of interval column and any `max-w` ancestors (client vs trainer).

### Phase 1 — Client page shell (`TrainerLiveClientJoinPage`)

1. Replace the standalone `<h1>Live session</h1>` block with the **shared branding bar** (§5.1), **without** host actions or session controls.
2. Restructure the in-session wrapper to **full-height / full-width** comparable to [`TrainerLiveHostView`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx): e.g. outer `fixed inset-0 flex flex-col` or equivalent with `FluidBackground` preserved if product requires it.
3. Move **wrapper error** (`wrapperErr`) into the same visual band as trainer (amber text aligned with top bar rules) for consistency.
4. Keep **Leave** / camera / mic controls inside [`TrainerLiveVideoShell`](../apps/app/src/components/react/trainer/live/TrainerLiveVideoShell.tsx) as today (no requirement to move them for this doc).

### Phase 2 — `TrainerLiveAmrapWrapper` (verify only)

1. Confirm **no** change required for parity aside from ensuring the **parent shell** no longer constrains width awkwardly.
2. Leave trainer-only timer background and Me/Leader toggle gated on `role === 'trainer'`.

### Phase 3 — AMRAP embed layout (`apps/amrap`)

1. Implement §5.3 so **participant** embed matches the **metric row** composition of the reference.
2. Verify **LOG ROUND** in `work` phase still lands in a predictable region (center vs below cards) for **both** roles; adjust only if the grid refactor breaks affordance.
3. Re-check `freeWorkoutWorkEmbed` and `isFreeWorkoutSegment` branches so they still read correctly.

### Phase 4 — Polish and tokens

1. Align **label casing** (“Live session” vs “LIVE SESSION”) with design system / screenshot — single token in the shared bar.
2. Confirm **focus order** and **aria** for the reflowed grid (two cards + exercises).

### Phase 5 — Tests

1. **Unit / component:** `AmrapTimerDisplay` layout when `beforeMainClock` is absent vs present (snapshot or role-based story).
2. **E2E / integration (optional):** join as client with active AMRAP; assert key `data-testid`s ([`trainer-live-amrap-shell`](../apps/app/src/lib/trainer-live/wrappers/amrap/TrainerLiveAmrapWrapper.tsx), timer region) and bounding box sanity if you have visual tooling.

---

## 7. Files likely touched

| Layer | Files |
|-------|--------|
| App shell | [`TrainerLiveClientJoinPage.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveClientJoinPage.tsx), [`TrainerLiveHostNavHeaderBar.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveHostNavHeaderBar.tsx) (or new shared bar), possibly [`TrainerLiveHostView.tsx`](../apps/app/src/components/react/trainer/live/TrainerLiveHostView.tsx) for composition only |
| AMRAP embed | [`AmrapSessionShell.tsx`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx), [`AmrapTimerDisplay.tsx`](../apps/amrap/src/components/amrap-session/AmrapTimerDisplay.tsx), optionally [`AmrapWorkPhaseControls.tsx`](../apps/amrap/src/components/amrap-session/AmrapWorkPhaseControls.tsx) |
| Tests | New/updated tests under `apps/amrap` (and/or `apps/app`) for layout branches |

---

## 8. Risks and open decisions

| Risk | Mitigation |
|------|------------|
| Full-bleed client layout breaks **join form** readability | Apply full-bleed only after `participantId` is set; keep `max-w-md` on pre-join card. |
| Collapsing grid breaks **trainer** layout | Gate layout on `isHost` or presence of `beforeMainClock`; snapshot both. |
| Host controls in embed vs only in nav | If product wants **identical** card row for trainer and client, consider moving **all** transport controls out of [`AmrapSessionShell`](../apps/amrap/src/components/amrap-session/AmrapSessionShell.tsx) into Mission Control for trainers only — larger change; optional follow-up. |

---

## 9. Acceptance criteria

- [ ] Client and trainer **interval column** shows the **same** title row, **two-card** metrics row, and **two-column** exercise grid for matching session phase and data.
- [ ] Client page uses **equivalent** full-width session shell as trainer (no `max-w-5xl` choke in-session).
- [ ] Client top bar matches trainer **branding** row; **no** host session controls appear for clients.
- [ ] Trainer-only items (**timer background video**, Me/Leader, Mission Control host navbar) remain **absent** on client.
- [ ] No regression to Tabata embed or `simple_countdown` shell (smoke test).
