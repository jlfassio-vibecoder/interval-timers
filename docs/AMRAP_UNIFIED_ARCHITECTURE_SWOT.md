# SWOT Analysis: Adapter-Based AMRAP Solo + Social Merger

**Goal:** Move from a highly coupled, feature-specific architecture to a composable, interface-driven architecture using the Adapter Pattern.

**Approach:** Define a uniform `AmrapSessionEngine` interface; implement separate adapter hooks (`useSoloAmrap`, `useSocialAmrap`); render a single `AmrapSessionShell` that receives the engine and stays mode-agnostic.

---

## Strengths

### 1. **Single Source of Truth for UI Logic**

The Shell and pure components receive one interface. No `if (isLive)` or `if (sessionMode === 'social')` scattered in the view layer. UI changes happen in one place and apply to Solo, Live, and future Published modes.

### 2. **Incremental Migration Path**

The phased rollout (UI extraction → interface → adapters → shell → features) keeps the app stable. Each step is verifiable. Existing `AmrapSessionPage` and `AmrapInterval` remain functional until the Shell is ready.

### 3. **Testability**

- **Engine interface:** Mock `AmrapSessionEngine` for Shell and child components.
- **Adapters:** `useSoloAmrap` and `useSocialAmrap` can be unit-tested in isolation.
- **Shell:** Renders with fixture data; no Supabase or Agora mocks required for UI tests.

### 4. **Extensibility**

Adding "Ghost Pacer" or "Async Head-to-Head" is a new adapter hook that returns `AmrapSessionEngine`. The Shell and components stay unchanged. This aligns with Open/Closed (open for extension, closed for modification).

### 5. **Type Safety**

A strict TypeScript interface enforces what the Shell needs. Adapters that fail to implement the contract are caught at compile time. Optional fields (e.g. `onPause`, `videoTrack`) keep the interface flexible without weakening type checks.

### 6. **Clear Separation of Concerns**

| Layer | Responsibility |
|-------|----------------|
| **Shell** | Layout, composition, prop drilling |
| **Pure components** | Presentational UI |
| **Adapters** | State, side effects, sync logic |
| **Pages** | Routing, adapter selection |

### 7. **Unified Join Flow**

A single "Join" surface that routes by ID format (e.g., short alphanumeric → live, UUID → published) improves UX and keeps routing logic in one place instead of multiple entry points.

---

## Weaknesses

### 1. **Interface Proliferation Risk**

`AmrapSessionEngine` must cover Solo, Live, and Published. It may grow with optional fields (`onPause?`, `onStartSetup?`, `workoutList?`, `scheduledStartAt?`). A bloated interface defeats the goal of simplicity.

**Mitigation:** Prefer composition (e.g. `engine.controls`, `engine.metadata`) or split into smaller sub-interfaces that the Shell composes.

### 2. **Edge Cases in the Adapters**

Social mode has many edge cases: scheduled start, countdown window, host-only controls, Who’s Here join, message board, copy link, Agora errors. `useSocialAmrap` will be complex. `useSoloAmrap` is simpler but must still support: setup modal, duration select, workout picker, sounds, analytics.

**Mitigation:** Keep adapters focused. Delegate sub-concerns to smaller hooks (e.g. `useSessionState` remains; Agora stays in its own hook; adapter only composes and maps to the interface).

### 3. **Different UX Surfaces**

Solo and Social currently have different chrome:

- **Solo:** Lives inside `IntervalTimerLanding` (hero, charts, CTA buttons) and a setup/timer modal.
- **Social:** Full-screen session page with Who’s Here, Message Board, Exercises, host livestream.

The Shell must either:
- Include all sections and hide some by layout (e.g. `participants.length > 1` for Who’s Here), or
- Accept optional sections via props/slots.

**Mitigation:** Define optional slots in the interface (e.g. `engine.slots?: { whoHere?: ReactNode; messageBoard?: ReactNode }`) or a `layoutVariant` that controls visibility. Document which sections each mode uses.

### 4. **State Machine Divergence**

- **Solo:** `idle` → `setup` → `work` → `finished` (no `waiting`).
- **Social:** `waiting` → `setup` → `work` → `finished` (includes scheduled start, Start button, host controls).

`timerPhase: 'idle' | 'setup' | 'work' | 'finished'` omits `waiting`. Social needs `waiting` for pre-start (share link, countdown).

**Mitigation:** Extend the interface to include `waiting` and treat `idle` as Solo’s pre-start. Or use `timerPhase: 'waiting' | 'setup' | 'work' | 'finished'` and map Solo `idle` → `waiting` in the adapter.

### 5. **Solo Landing vs Session Page**

Solo is not “just” a timer; it includes the AMRAP landing (hero, data, simulator, Learn More). The Shell is only the *session* (timer + leaderboard + controls). The Solo page would be: Landing + [Setup Modal → Shell when timer runs]. This is a different page structure than Social’s dedicated session page.

**Mitigation:** Treat the Shell as the session UI only. `SoloAmrapPage` = Landing + Setup Flow; when user starts, it renders the Shell with `useSoloAmrap`. `SocialAmrapPage` = Shell only (session is the whole page). The interface remains the same; only the page wrapper differs.

---

## Opportunities

### 1. **Reuse Across Other Protocols**

The pattern (uniform engine + adapters + shell) can be applied to Tabata, EMOM, etc., if they add social or published modes. A shared `SessionEngine<T>` generic could emerge.

### 2. **Published Workout Leaderboards**

With a clean adapter for `published` mode, adding global leaderboards by workout ID is straightforward. The Shell already renders `participants`; Published mode would fetch leaderboard entries and map them into the same shape (with no live video).

### 3. **Self-Recording Without Coupling**

`useSoloAmrap` can add `MediaRecorder` / `getUserMedia` for self-recording. The `participants` array would have one entry with `videoTrack` as a local `MediaStream`. `LeaderboardRow` already accepts optional `videoTrack`; no Shell changes needed.

### 4. **Shared WorkoutPicker and Setup**

`WorkoutPicker` is already shared. The setup flow (duration, workout, schedule) can be reused for Create (Social) and Launch (Solo). Both feed into the same engine interface (workout config).

### 5. **Consistent Analytics**

With a single Shell and engine interface, analytics events can be centralized. Each adapter calls a shared `trackAmrapEvent` with a `sessionMode` parameter.

---

## Threats

### 1. **Over-Abstraction**

The interface might become too generic (e.g. `videoTrack?: any`) and lose type safety. Or the Shell might receive so many optional props that it turns into a “god component” with hidden branching.

**Mitigation:** Prefer discriminated unions or mode-specific sub-interfaces. Use `sessionMode` to narrow types where needed. Keep the interface minimal and extend via composition.

### 2. **Regressions During Migration**

Refactoring ~550 lines in `AmrapSessionPage` and ~900 in `AmrapInterval` risks subtle regressions: timer drift, round sync, video mapping, scheduled start behavior.

**Mitigation:** Keep Phase 1 (UI extraction) as pure extraction with no logic changes. Add regression tests for critical paths (timer phases, log round, join session) before and during the merge.

### 3. **Hub App Duplication**

The hub app (`apps/app`) has its own `AmrapInterval` that embeds a simplified timer. If the unified Shell lives in `apps/amrap`, the hub must either import from amrap or duplicate the Shell. Package boundaries and dependency direction matter.

**Mitigation:** Move shared components and the Shell into a package (e.g. `packages/amrap-ui`) that both `apps/amrap` and `apps/app` depend on. Or keep the Shell in `apps/amrap` and have the hub use an iframe/route to the amrap app for the full experience.

### 4. **ID Format Assumptions for Join Router**

Routing by "6-char alphanumeric = live, UUID = published" is brittle. Session IDs from Supabase are UUIDs. The proposed format (short code for live) would require a new short-code system or a different identifier.

**Mitigation:** Use URL path to disambiguate instead of ID format: `/amrap/live/:sessionId` vs `/amrap/workout/:workoutId`. Or use a query param: `?mode=live` vs `?mode=workout`. Avoid inferring mode from ID structure alone.

### 5. **Agora and Solo Recording Compatibility**

`LeaderboardRow` uses Agora `ICameraVideoTrack | IRemoteVideoTrack`. Solo recording would use `MediaStream` or `MediaRecorder`. The `videoTrack` type in the interface would need to accept both, or the Shell would need a small abstraction (e.g. a `VideoSource` type that can be Agora track or MediaStream).

**Mitigation:** Define `VideoSource = ICameraVideoTrack | IRemoteVideoTrack | MediaStream` and ensure `VideoTile` / `LeaderboardRow` can render any of these, or create a thin adapter component that normalizes playback.

---

## Summary Matrix

| Factor | Severity | Mitigation |
|--------|----------|------------|
| Interface bloat | Medium | Composition, sub-interfaces |
| Adapter complexity | Medium | Delegate to smaller hooks |
| Different chrome (landing vs session) | Medium | Shell = session only; pages differ |
| State machine divergence (waiting) | Low | Extend interface |
| Over-abstraction | Medium | Discriminated unions, minimal interface |
| Regressions | High | Phased migration, tests |
| Hub app coupling | Medium | Shared package or routing |
| Join ID format | Medium | Use URL/path, not ID shape |
| Video type compatibility | Low | `VideoSource` union or adapter component |

---

## Recommended Adjustments to the Plan

1. **Include `waiting` in `timerPhase`** and map Solo `idle` to `waiting` in `useSoloAmrap` so both modes share the same state shape.
2. **Use URL routing for Join**, not ID format: `/amrap/join/live/:id` and `/amrap/join/workout/:id`, or a single `/amrap/join` page with a mode selector.
3. **Introduce `engine.slots`** (or similar) for mode-specific sections (Who’s Here, Message Board) so the Shell can render them without knowing their internals.
4. **Create `packages/amrap-ui`** early if the hub app will reuse the Shell; otherwise document that the hub may keep its own simplified timer for now.
5. **Define `VideoSource`** (Agora tracks + MediaStream) in the interface and add a small adapter component for playback.

---

## Conclusion

The Adapter-based approach is well-suited for merging Solo and Social AMRAP views. The main strengths are clear separation of concerns, extensibility, and incremental migration. The main risks are interface creep, regressions, and UX differences between Solo (landing + modal) and Social (full-page session). With the mitigations above—phased rollout, URL-based Join routing, and a `VideoSource` abstraction—the plan is viable and should significantly reduce maintenance overhead while enabling future modes (Published, Ghost Pacer) without destabilizing existing functionality.
