# Technical Design: Interval Wrapper — Production Implementation Guide

**Audience:** AI agent implementing a production-grade interval wrapper (AMRAP or equivalent) inside a
shared Agora video session in a new host application.  
**Pattern source:** `apps/app` + `apps/amrap` in this monorepo — this document distills that reference
implementation and folds in all known gap-analysis fixes. Implement from this doc; use the existing
code as secondary reference only.

---

## 1. Core Invariants (never violate these)

| # | Invariant |
|---|---|
| **I1** | **One Agora channel per physical room.** The host app owns Agora (`channel = host_session.id`). The interval wrapper engine must **never** initialise its own Agora channel for the same set of users. |
| **I2** | **Registry is the single dispatch point.** Every wrapper kind (including `simple_countdown`) is resolved through the registry. No wrapper kind is hard-coded by name in `SessionRoom`. |
| **I3** | **Video identity keyed on leader change, not score change.** Any effect that resolves "who is the video leader" must dep on the leader's *identity* (`id`), not their *score* (`.rounds`). |
| **I4** | **`trainer_live_list_participants` is called once per session view, from one owner.** A shared context or prop provides the resolved trainer participant id; components do not each issue their own copy of the RPC. |
| **I5** | **Every wrapper is wrapped in a React `ErrorBoundary`.** A render-time crash in the interval panel must never cascade to the video room. |
| **I6** | **No secrets in `interval_wrapper_config`.** The config JSON is safe to include in `join_hints`; session membership rules enforce access. |

---

## 2. System Overview

```
┌─────────────────────────── Host App (e.g. Mission Control) ───────────────────────────┐
│                                                                                        │
│  ┌────────────────────────┐      ┌──────────────────────────────────────────────────┐ │
│  │  VideoShell            │      │  IntervalSidebar                                 │ │
│  │  (Agora channel =      │      │  ┌──────────────────────────────────────────┐    │ │
│  │   host_session.id)     │      │  │  WrapperErrorBoundary                    │    │ │
│  │                        │      │  │  ┌────────────────────────────────────┐  │    │ │
│  │  localVideoTrack  ─────┼──────┼──┼──┤  TrainerLiveAmrapWrapper           │  │    │ │
│  │  remoteUsers[]    ─────┼──────┼──┼──┤  (or any registered wrapper)       │  │    │ │
│  │  excludeUidForTiles ───┼──────┼──┼──┤                                    │  │    │ │
│  │                        │      │  │  │  useSocialAmrapEmbedded            │  │    │ │
│  │  ◄─── Agora RTC ──────►│      │  │  │  (skipAgora: true)                 │  │    │ │
│  └────────────────────────┘      │  │  │  AmrapSessionShell                 │  │    │ │
│                                  │  │  │  TimerVideoBackground              │  │    │ │
│  VideoFeedDrawer (collapsible)   │  │  └────────────────────────────────────┘  │    │ │
│  ┌────────────────────────┐      │  └──────────────────────────────────────────┘    │ │
│  │  Video tiles           │      │                                                  │ │
│  │  (excludeUidForTiles   │      └──────────────────────────────────────────────────┘ │
│  │   → placeholder tile)  │                                                           │
│  └────────────────────────┘                                                           │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘

Supabase
┌──────────────────────────────────────────────────────────┐
│  host_sessions   (interval_wrapper_kind, _config)        │
│  host_participants                                        │
│  amrap_sessions  ← linked via interval_wrapper_config    │
│  amrap_participants, amrap_session_rounds                 │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Columns on `host_sessions`

```sql
ALTER TABLE public.host_sessions
  ADD COLUMN interval_wrapper_kind text NOT NULL DEFAULT 'none'
    CONSTRAINT host_sessions_interval_wrapper_kind_check
      CHECK (interval_wrapper_kind IN ('none','simple_countdown','amrap','tabata','emom')),
  ADD COLUMN interval_wrapper_config jsonb NULL;
```

- **`none`** — no interval UI; sidebar shows empty/picker state.
- **`simple_countdown`** — block countdown; config is `null` or `{ preset_seconds: N }`.
- **`amrap`** — links to `amrap_sessions`; config is `{ "amrap_session_id": "<uuid>" }`.
- Extend the check constraint as new kinds ship.

### 3.2 Recommended: `amrap_sessions.host_session_id`

```sql
ALTER TABLE public.amrap_sessions
  ADD COLUMN host_session_id uuid NULL REFERENCES host_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX amrap_sessions_host_session_id_active_idx
  ON public.amrap_sessions (host_session_id)
  WHERE host_session_id IS NOT NULL;
```

This enables reverse lookup ("all AMRAP sessions spawned from this session") without scanning
`interval_wrapper_config`. If you cannot touch the AMRAP schema, config-only is acceptable; document
the limitation.

### 3.3 Attach RPC

```sql
-- SECURITY DEFINER; caller must be host_sessions.trainer_user_id
CREATE OR REPLACE FUNCTION public.host_attach_amrap_session(
  p_host_session_id uuid,
  p_duration_minutes int,
  p_workout_list     jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amrap_session_id uuid;
  v_host_token       text;
  v_participant_id   uuid;
BEGIN
  -- Authorisation
  IF NOT EXISTS (
    SELECT 1 FROM host_sessions
    WHERE id = p_host_session_id
      AND trainer_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  -- Idempotency: reuse existing AMRAP if already attached
  SELECT (interval_wrapper_config->>'amrap_session_id')::uuid
    INTO v_amrap_session_id
    FROM host_sessions
    WHERE id = p_host_session_id
      AND interval_wrapper_kind = 'amrap';

  IF v_amrap_session_id IS NULL THEN
    -- Create AMRAP session (adapt to your amrap_sessions schema)
    INSERT INTO amrap_sessions (duration_minutes, workout_list, host_session_id)
    VALUES (p_duration_minutes, p_workout_list, p_host_session_id)
    RETURNING id INTO v_amrap_session_id;

    -- Create host participant row (mirror standalone AMRAP host-bootstrap)
    INSERT INTO amrap_participants (amrap_session_id, user_id, display_name, is_host)
    VALUES (v_amrap_session_id, auth.uid(),
            (SELECT display_name FROM profiles WHERE id = auth.uid()),
            true)
    RETURNING id INTO v_participant_id;

    -- Generate host token (adapt to your token scheme)
    v_host_token := encode(gen_random_bytes(32), 'hex');
    UPDATE amrap_sessions SET host_token = v_host_token WHERE id = v_amrap_session_id;

    UPDATE host_sessions
      SET interval_wrapper_kind   = 'amrap',
          interval_wrapper_config = jsonb_build_object('amrap_session_id', v_amrap_session_id)
      WHERE id = p_host_session_id;
  END IF;

  RETURN jsonb_build_object(
    'amrap_session_id',   v_amrap_session_id,
    'host_token',         v_host_token,
    'amrap_participant_id', v_participant_id
  );
END;
$$;
```

### 3.4 Set-wrapper RPC (trainer-only, used for all kind changes)

```sql
CREATE OR REPLACE FUNCTION public.host_set_interval_wrapper(
  p_host_session_id uuid,
  p_kind            text,
  p_config          jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM host_sessions
    WHERE id = p_host_session_id AND trainer_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  IF p_kind NOT IN ('none','simple_countdown','amrap','tabata','emom') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  UPDATE host_sessions
    SET interval_wrapper_kind   = p_kind,
        interval_wrapper_config = p_config
    WHERE id = p_host_session_id;
END;
$$;
```

### 3.5 Join hints RPC extension

Extend your existing `session_join_hints` RPC to return:

```jsonc
{
  "shell": "countdown_timer",
  "interval_wrapper_kind": "amrap",
  "interval_wrapper_config": { "amrap_session_id": "<uuid>" }
  // Do NOT include host_token or any secret in join_hints
}
```

Clients must observe wrapper-kind changes without a full page reload. **Pick exactly one** of:
- **Supabase Realtime** channel subscription on `host_sessions WHERE id = $sessionId`, listening for
  `UPDATE` events on `interval_wrapper_kind`.
- **Polling** `session_join_hints` at a low interval (≤ 5 s). Document the choice in your repo's
  COMMANDS.md.

---

## 4. TypeScript Types

```ts
// lib/wrappers/types.ts

export type IntervalWrapperKind =
  | 'none'
  | 'simple_countdown'
  | 'amrap'
  | 'tabata'
  | 'emom';

export interface WrapperBaseProps {
  /** UUID; also the Agora channel id. Never used to initialise a second Agora channel. */
  hostSessionId: string;
  /** Caller's host_participants.id (Agora account string for video). */
  participantId: string;
  role: 'trainer' | 'client';
  displayName: string;
  authUserId: string | null;
  /** Raw DB JSON; each wrapper validates its own shape. */
  wrapperConfig: unknown;
  /** Surface non-fatal errors in the host app's amber banner row. */
  onWrapperError?: (message: string) => void;
  /**
   * The Agora uid whose tile is excluded from the video grid because it is shown on the timer
   * background. Each wrapper supplies this to the timer background component.
   * The timer background must re-call track.play() when this changes (track.stop() is called by
   * the departing tile).
   */
  videoTileExcludeUid?: string | null;
  /**
   * Resolved trainer host_participants.id, fetched once by the parent SessionRoom and passed down.
   * Eliminates per-wrapper RPC calls for trainer participant lookup (I4).
   */
  trainerParticipantId: string | null;
}
```

---

## 5. Config Parsers

```ts
// lib/wrappers/parseWrapperConfig.ts

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidField(config: unknown, field: string): string | null {
  if (config == null || typeof config !== 'object') return null;
  const raw = (config as Record<string, unknown>)[field];
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

export const parseAmrapSessionIdFromWrapperConfig = (c: unknown) =>
  parseUuidField(c, 'amrap_session_id');

export const parseTabataSessionIdFromWrapperConfig = (c: unknown) =>
  parseUuidField(c, 'tabata_session_id');

export const parseEmomSessionIdFromWrapperConfig = (c: unknown) =>
  parseUuidField(c, 'emom_session_id');
```

---

## 6. Registry

```ts
// lib/wrappers/registry.tsx
import type { ComponentType } from 'react';
import type { IntervalWrapperKind, WrapperBaseProps } from './types';
import SimpleCountdownWrapper from './simple-countdown/SimpleCountdownWrapper';
import AmrapWrapper from './amrap/AmrapWrapper';
// import TabataWrapper from './tabata/TabataWrapper';
// import EmomWrapper from './emom/EmomWrapper';

type WrapperComponent = ComponentType<WrapperBaseProps>;

// REQUIREMENT (I2): ALL kinds including simple_countdown live here. SessionRoom does not
// switch on kind by name — it calls getIntervalWrapper() only.
const registry: Partial<Record<IntervalWrapperKind, WrapperComponent>> = {
  simple_countdown: SimpleCountdownWrapper,
  amrap: AmrapWrapper,
  // tabata: TabataWrapper,
  // emom: EmomWrapper,
};

export function getIntervalWrapper(kind: IntervalWrapperKind): WrapperComponent | null {
  return registry[kind] ?? null;
}
```

---

## 7. `SessionRoom` Integration

`SessionRoom` is the layout host. It is responsible for:
1. Fetching `trainerParticipantId` once and passing it to all wrappers (I4).
2. Computing `excludeUidForTiles` using a hook, not an inline ternary.
3. Dispatching to the registry — never branching on kind names itself (I2).
4. Wrapping all registry renders in `WrapperErrorBoundary` (I5).

```tsx
// components/SessionRoom.tsx  (abbreviated for clarity)

import { useEffect, useState } from 'react';
import { getIntervalWrapper } from '@/lib/wrappers/registry';
import WrapperErrorBoundary from '@/lib/wrappers/WrapperErrorBoundary';
import { useExcludeUidForTiles } from '@/hooks/useExcludeUidForTiles';
import VideoShell from './VideoShell';

export default function SessionRoom({ shell, sessionId, participantId, role, ... }) {
  // I4: single RPC call for trainer participant id, owned here, passed as prop
  const [trainerParticipantId, setTrainerParticipantId] = useState<string | null>(null);
  useEffect(() => {
    if (shell !== 'countdown_timer') return;
    let cancelled = false;
    void supabase
      .rpc('list_participants', { p_session_id: sessionId })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as { id: string; role: string }[];
        setTrainerParticipantId(rows.find(r => r.role === 'trainer')?.id ?? null);
      });
    return () => { cancelled = true; };
  }, [shell, sessionId]);

  // I3 + no-ternary: compute excludeUidForTiles in a hook (see §8)
  const excludeUidForTiles = useExcludeUidForTiles({
    shell, role, participantId, intervalWrapperKind, trainerParticipantId,
  });

  const WrapperCmp = shell === 'countdown_timer'
    ? getIntervalWrapper(intervalWrapperKind)
    : null;

  const wrapperProps: WrapperBaseProps = {
    hostSessionId: sessionId,
    participantId,
    role,
    displayName,
    authUserId,
    wrapperConfig: intervalWrapperConfig,
    onWrapperError,
    videoTileExcludeUid: excludeUidForTiles,
    trainerParticipantId,   // I4
  };

  const intervalSidebar = (() => {
    if (!WrapperCmp) {
      return <IntervalEmptyState role={role} />;
    }
    return (
      // I5: error boundary around every registry render
      <WrapperErrorBoundary onError={onWrapperError}>
        <WrapperCmp {...wrapperProps} />
      </WrapperErrorBoundary>
    );
  })();

  // render layout…
}
```

### 7.1 `useExcludeUidForTiles` hook

Extract the uid-exclusion logic into a dedicated hook. Each new wrapper kind registers itself here
rather than adding a branch to `SessionRoom`.

```ts
// hooks/useExcludeUidForTiles.ts
import { useTimerBackground } from '@/contexts/TimerBackgroundContext';

interface Options {
  shell: string;
  role: 'trainer' | 'client';
  participantId: string;
  intervalWrapperKind: string;
  trainerParticipantId: string | null;
}

export function useExcludeUidForTiles({
  shell, role, participantId, intervalWrapperKind, trainerParticipantId,
}: Options): string | null {
  const timerBg = useTimerBackground();   // null when no timer background is active

  if (shell !== 'countdown_timer' || !timerBg) return null;

  // Wrappers that show a video background exclude someone from the tile grid.
  // Trainers exclude whoever is on the background (self or the current leader).
  // Clients always exclude the trainer — they see the trainer on the background.
  const wrapperHasBackground = ['amrap', 'tabata', 'emom'].includes(intervalWrapperKind);
  if (!wrapperHasBackground) return null;

  if (role === 'client') return trainerParticipantId;

  // Trainer: timerBg.spotlightParticipantId is set by the active wrapper (see §10)
  return timerBg.spotlightParticipantId ?? participantId;
}
```

---

## 8. `WrapperErrorBoundary`

```tsx
// lib/wrappers/WrapperErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (message: string) => void;
}

interface State { error: Error | null }

export default class WrapperErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WrapperErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          Interval tool encountered an error. Video is still active.{' '}
          <button onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 9. Embed API Contract (`useSocialAmrapEmbedded`)

This lives in the interval-engine package / app and is exported via a dedicated subpath
(e.g. `amrap/embed`). The host app imports only from this subpath — never from internal
engine files.

```ts
// amrap/embed/index.ts  (the public surface)

export type UseSocialAmrapEmbeddedOptions = {
  amrapSessionId: string;
  /** Only supported value. Prevents the engine from initialising its own Agora channel (I1). */
  embedVideo: 'host_session';
  /** Display name for auto client-join (guests log rounds without a separate join UI). */
  trainerLiveJoinNickname?: string;
  /** Forward the host app's known auth user id for identity mapping (§11). */
  authUserId?: string | null;
  onDismissFinishedRecap?: () => void;
  recapDismissed?: boolean;
};

export function useSocialAmrapEmbedded(
  options: UseSocialAmrapEmbeddedOptions
): AmrapSessionEngine {
  const { amrapSessionId, embedVideo, authUserId, ...rest } = options;
  if (embedVideo !== 'host_session') {
    throw new Error(`useSocialAmrapEmbedded: unsupported embedVideo "${String(embedVideo)}"`);
  }
  return useSocialAmrap(amrapSessionId, {
    ...rest,
    skipAgora: true,          // I1
    hideMessageBoard: true,   // host app provides chat
    whosHereInSessionDrawer: true,
    trainerLiveHostNavActions: true,
    trainerLiveChatDrawerLeaderboard: true,
    authUserId,
  });
}

// Re-export everything the host app needs to render the AMRAP panel
export { AmrapSessionShell, AmrapEmbedExerciseSection, ViewResultsModal } from './components';
export { AmrapAuthProvider, useAmrapAuth } from './contexts/AmrapAuthContext';
export type { AmrapSessionEngine, AmrapTimerPhase } from './types';
export { setStoredHostToken, setStoredParticipantId } from './hooks/useAmrapSession';
```

**Router note:** If the engine uses `react-router-dom` `Link` internally, the host app must
provide a compatible `Router` context above `AmrapAuthProvider`, or the engine must conditionally
render `<a>` instead of `<Link>` when `embedVideo` is set. **Audit every `Link` usage in the
engine before shipping;** replace with `<a href={...}>` or a passed-in `navigate` callback for
all in-embed code paths.

---

## 10. `AmrapWrapper` Component

```tsx
// lib/wrappers/amrap/AmrapWrapper.tsx

import { useEffect, useState, createPortal } from 'react';
import {
  AmrapAuthProvider,
  AmrapSessionShell,
  AmrapEmbedExerciseSection,
  ViewResultsModal,
  useSocialAmrapEmbedded,
} from 'amrap/embed';
import { useTimerBackground } from '@/contexts/TimerBackgroundContext';
import TimerVideoBackground from '@/components/TimerVideoBackground';
import MeLeaderToggle from '@/components/MeLeaderToggle';
import { useSessionDrawer } from '@/contexts/SessionDrawerContext';
import { useChatDrawer } from '@/contexts/ChatDrawerContext';
import { useHostNavActions } from '@/contexts/HostNavActionsContext';
import { parseAmrapSessionIdFromWrapperConfig } from '@/lib/wrappers/parseWrapperConfig';
import type { WrapperBaseProps } from '@/lib/wrappers/types';

function AmrapBody({
  amrapSessionId, hostSessionId, participantId, role, displayName, authUserId,
  onWrapperError, videoTileExcludeUid, trainerParticipantId,
}: {
  amrapSessionId: string;
} & Omit<WrapperBaseProps, 'wrapperConfig'>) {
  const [recapDismissed, setRecapDismissed] = useState(false);

  const engine = useSocialAmrapEmbedded({
    amrapSessionId,
    embedVideo: 'host_session',
    authUserId,                  // forward so engine can prefer auth over guest join
    trainerLiveJoinNickname: role === 'client' ? displayName.trim() || 'Guest' : undefined,
    onDismissFinishedRecap: () => setRecapDismissed(true),
    recapDismissed,
  });

  // Reset recap flag when session moves out of finished state
  useEffect(() => {
    if (engine.timerPhase !== 'finished') setRecapDismissed(false);
  }, [engine.timerPhase]);

  // Surface errors upward (non-fatal: video room stays alive)
  useEffect(() => {
    const err = engine.error ?? engine.pageState?.agoraError;
    if (err) onWrapperError?.(err);
  }, [engine.error, engine.pageState?.agoraError, onWrapperError]);

  // Slot portals: inject AMRAP sub-panels into host chrome
  const { setSessionDrawerNode } = useSessionDrawer();
  const { setChatDrawerLeaderboard } = useChatDrawer();
  const { setHostNavActions } = useHostNavActions();

  useEffect(() => {
    setSessionDrawerNode(engine.slots?.sessionDrawer ?? null);
    return () => setSessionDrawerNode(null);
  }, [engine.slots?.sessionDrawer, setSessionDrawerNode]);

  useEffect(() => {
    setChatDrawerLeaderboard(engine.slots?.chatDrawerLeaderboard ?? null);
    return () => setChatDrawerLeaderboard(null);
  }, [engine.slots?.chatDrawerLeaderboard, setChatDrawerLeaderboard]);

  useEffect(() => {
    setHostNavActions(engine.slots?.hostNavActions ?? null);
    return () => setHostNavActions(null);
  }, [engine.slots?.hostNavActions, setHostNavActions]);

  // Notify TimerBackgroundContext what uid the trainer is spotlighting (I3, useExcludeUidForTiles)
  const { setSpotlightParticipantId, mode } = useTimerBackground();
  useEffect(() => {
    // Wrapper sets spotlight; SessionRoom reads it for excludeUidForTiles (no ternary in Room)
    // spotlightParticipantId is resolved in TimerVideoBackground and written back here
  }, [setSpotlightParticipantId]);

  const isTrainer = role === 'trainer';
  const ps = engine.pageState;

  const viewResultsPortal =
    typeof document !== 'undefined' && ps
      ? createPortal(
          <ViewResultsModal
            isOpen={Boolean(ps.showViewResultsModal)}
            onClose={() => ps.handleCloseViewResults?.()}
            isHost={ps.isHost}
            resultsText={ps.viewResultsText ?? ''}
            onCopy={() => void ps.copyResults?.()}
            copyToast={ps.copyResultsToast ?? null}
            roundDurations={ps.roundDurations ?? []}
          />,
          document.body
        )
      : null;

  return (
    <div
      className="relative w-full min-w-0 text-white"
      data-region="interval-amrap"
      data-testid="amrap-wrapper-shell"
    >
      {viewResultsPortal}
      <TimerVideoBackground
        engine={engine}
        hostSessionId={hostSessionId}
        participantId={participantId}
        role={role}
        videoTileExcludeUid={videoTileExcludeUid}
        trainerParticipantId={trainerParticipantId}     // I4: passed in, not re-fetched
        videoBottomOverlay={
          isTrainer ? (
            <AmrapEmbedExerciseSection engine={engine} maxTwoColumns />
          ) : undefined
        }
      />
      <div className="relative z-10">
        <AmrapSessionShell
          engine={engine}
          shellLayout="hostEmbed"
          embedSuppressExercises={isTrainer}
          embedClientLiveLayout={!isTrainer}
          embedTitleBarAccessoryBeforeSub={isTrainer ? <MeLeaderToggle /> : undefined}
        />
      </div>
    </div>
  );
}

export default function AmrapWrapper(props: WrapperBaseProps) {
  const {
    wrapperConfig, onWrapperError, hostSessionId, participantId,
    role, displayName, authUserId, videoTileExcludeUid, trainerParticipantId,
  } = props;

  const amrapSessionId = parseAmrapSessionIdFromWrapperConfig(wrapperConfig);

  if (!amrapSessionId) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        Missing or invalid AMRAP session. Ask the trainer to restart AMRAP.
      </div>
    );
  }

  return (
    <AmrapAuthProvider>
      <AmrapBody
        amrapSessionId={amrapSessionId}
        hostSessionId={hostSessionId}
        participantId={participantId}
        role={role}
        displayName={displayName}
        authUserId={authUserId}
        onWrapperError={onWrapperError}
        videoTileExcludeUid={videoTileExcludeUid}
        trainerParticipantId={trainerParticipantId}
      />
    </AmrapAuthProvider>
  );
}
```

---

## 11. `TimerVideoBackground` Component

This is the most sensitive component. Follow the rules below exactly.

```tsx
// components/TimerVideoBackground.tsx

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { useAgoraContext } from '@/contexts/AgoraContext';
import { useTimerBackground } from '@/contexts/TimerBackgroundContext';
import type { AmrapSessionEngine } from 'amrap/embed';

export default function TimerVideoBackground({
  engine,
  hostSessionId,
  participantId,
  role,
  videoTileExcludeUid,
  videoBottomOverlay,
  trainerParticipantId,   // I4: received as prop, never fetched here
}: {
  engine: AmrapSessionEngine;
  hostSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  videoTileExcludeUid?: string | null;
  videoBottomOverlay?: ReactNode;
  trainerParticipantId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { localVideoTrack, remoteUsers } = useAgoraContext();
  const { mode, leaderParticipantId, setLeaderParticipantId, setSpotlightParticipantId } =
    useTimerBackground();

  // ─── Leader resolution (I3: dep on leaderId only, NOT on rounds) ──────────────
  //
  // IMPORTANT: sort participants and extract leaderId BEFORE the effect. Use only
  // leaderId as a dep — not `${leaderId}:${rounds}`. Changing rounds does not change
  // who is on video; re-running two DB queries on every round log is a performance
  // bug that scales with session activity.

  const sortedParticipants = [...engine.participants].sort((a, b) => {
    if (b.rounds !== a.rounds) return b.rounds - a.rounds;
    return a.name.localeCompare(b.name);
  });
  const leaderId = sortedParticipants[0]?.id ?? null;   // ← identity only

  useEffect(() => {
    if (role === 'client' || !leaderId) {
      setLeaderParticipantId(null);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      // Step 1: amrap_participants → auth user_id
      const { data: ap } = await supabase
        .from('amrap_participants')
        .select('user_id')
        .eq('id', leaderId)
        .maybeSingle();
      if (cancelled || !ap?.user_id) { setLeaderParticipantId(null); return; }

      // Step 2: host_participants → participant id (Agora account string)
      const { data: hp } = await supabase
        .from('host_participants')
        .select('id')
        .eq('session_id', hostSessionId)
        .eq('user_id', ap.user_id)
        .maybeSingle();
      if (cancelled) return;
      setLeaderParticipantId(hp?.id ?? null);
    };

    void resolve();
    return () => { cancelled = true; };

  // ↓ leaderId only — NOT leaderRow.rounds (I3)
  }, [role, leaderId, hostSessionId, setLeaderParticipantId]);

  // Keep TimerBackgroundContext's spotlightParticipantId in sync so SessionRoom's
  // useExcludeUidForTiles hook always has the correct uid to exclude from tiles.
  useEffect(() => {
    if (role === 'client') { setSpotlightParticipantId(null); return; }
    const spotlight =
      mode === 'self'
        ? participantId
        : (leaderParticipantId ?? participantId);
    setSpotlightParticipantId(spotlight);
    return () => setSpotlightParticipantId(null);
  }, [role, mode, participantId, leaderParticipantId, setSpotlightParticipantId]);

  // ─── Track selection ──────────────────────────────────────────────────────────

  const leaderIsSelf = leaderParticipantId != null
    && String(leaderParticipantId) === String(participantId);

  const remoteForLeader =
    !leaderIsSelf && leaderParticipantId != null
      ? remoteUsers.find(u => String(u.uid) === String(leaderParticipantId))
      : undefined;

  // Client: always show trainer feed
  // Trainer "self" mode: local camera
  // Trainer "leader" mode: leader's remote feed (or local if leader is self)
  const remoteForTrainer =
    role === 'client' && trainerParticipantId != null
      ? remoteUsers.find(u => String(u.uid) === String(trainerParticipantId))
      : undefined;

  // Fallback for client when trainer participant id has not resolved yet:
  // show any remote that is not self (usually the trainer, who joins first).
  const clientFallbackRemote =
    role === 'client' && remoteForTrainer == null
      ? remoteUsers.find(u => String(u.uid) !== String(participantId))
      : undefined;

  const activeTrack: ICameraVideoTrack | IRemoteVideoTrack | null =
    role === 'client'
      ? ((remoteForTrainer ?? clientFallbackRemote)?.videoTrack ?? null)
      : mode === 'self' || leaderIsSelf
        ? localVideoTrack
        : (remoteForLeader?.videoTrack ?? null);

  // ─── play() / no-stop() pattern ──────────────────────────────────────────────
  //
  // NEVER call track.stop() in this effect's cleanup. The same ICameraVideoTrack /
  // IRemoteVideoTrack instance is shared with the video tile grid. Calling stop()
  // here would black out the tile.
  //
  // videoTileExcludeUid IS a dep: when the tile for a uid is excluded, the departing
  // TrainerLiveRemoteTile calls track.stop(). This dep causes the effect to re-run
  // immediately after the stop(), reattaching play() to our container.
  useEffect(() => {
    const el = containerRef.current;
    if (!activeTrack || !el) return;
    activeTrack.play(el, { fit: 'cover' });
    // intentional: no cleanup stop() — see comment above
  }, [activeTrack, videoTileExcludeUid]);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 aspect-video w-full overflow-hidden rounded-b-2xl"
        data-region="timer-video-background"
      >
        <div
          ref={containerRef}
          className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        {videoBottomOverlay != null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex max-h-[55%] flex-col justify-end">
            <div className="pointer-events-auto max-h-full overflow-y-auto rounded-b-2xl bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
              {videoBottomOverlay}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

---

## 12. `TimerBackgroundContext`

All wrapper kinds that show a video background write their `spotlightParticipantId` here.
`SessionRoom` reads it via `useExcludeUidForTiles` (§7.1). No wrapper inspects another wrapper's context.

```ts
// contexts/TimerBackgroundContext.ts

export interface TimerBackgroundState {
  mode: 'self' | 'leader';
  setMode: (m: 'self' | 'leader') => void;
  /** Agora uid (host_participants.id) currently spotlighted on the background. */
  spotlightParticipantId: string | null;
  setSpotlightParticipantId: (id: string | null) => void;
  /** For AMRAP Me/Leader: resolved Agora uid of the current AMRAP leader. */
  leaderParticipantId: string | null;
  setLeaderParticipantId: (id: string | null) => void;
}
```

---

## 13. Participant Identity Mapping

The host app (Trainer Live) and the interval engine (AMRAP) use separate participant tables.
Mapping between them must happen exactly once per session, not per-render.

| Priority | Signal | Use when |
|---|---|---|
| 1 | `auth.uid()` | User is authenticated. Use `user_id` to join AMRAP participant. |
| 2 | Stored guest claim token | `sessionStorage` key: `amrap_guest_${amrapSessionId}`. Survives refresh in same tab. |
| 3 | `trainerLiveJoinNickname` auto-join | No stored token; engine calls `join_session` with display name on first interaction. |

**Deduplication:** Enforce 1:1 participant rows per `(amrap_session_id, user_id)` in the `join_session` RPC (upsert on conflict). This prevents duplicate leaderboard entries when a user navigates back.

**Trainer bootstrap:** `host_attach_amrap_session` creates the trainer's AMRAP participant row
server-side. The returned `{ host_token, amrap_participant_id }` must be stored immediately via
`setStoredHostToken` / `setStoredParticipantId` so the engine picks them up on mount.

---

## 14. Wrapper Switch — Confirm Dialog

When the trainer changes `interval_wrapper_kind` while the current AMRAP `timerPhase` is not
`'finished'`:

1. Show a modal summarising consequences:
   - Guest participants' claim tokens may be lost if the session is not resumed.
   - Logged rounds are preserved in the database.
   - The AMRAP session pauses but is not deleted.
2. Trainer confirms → call `host_set_interval_wrapper`.
3. Trainer cancels → no change.

This dialog is gated on `timerPhase !== 'finished'` and `intervalWrapperKind === 'amrap'`. Wire it
in `SessionActivityRail` or wherever the trainer changes tools — not inside `AmrapWrapper` itself
(the wrapper should not need to know it is about to be unmounted).

---

## 15. Security Checklist

| Concern | Requirement |
|---|---|
| Attach AMRAP | Only `host_sessions.trainer_user_id` via `SECURITY DEFINER` RPC. |
| Change wrapper kind | Only `trainer_user_id` via `host_set_interval_wrapper` (SECURITY DEFINER). |
| Read AMRAP state | Existing AMRAP RLS unchanged. |
| `interval_wrapper_config` | No tokens, no secrets. `amrap_session_id` UUID is acceptable. |
| `join_hints` | Return `interval_wrapper_kind` and safe config fields only. |
| Agora tokens | Host app's existing token verification path — unchanged. |

---

## 16. Analytics Events

Instrument the following in `AmrapBody` using your analytics client:

| Event | When | Key properties |
|---|---|---|
| `interval_wrapper_amrap_attach` | Trainer calls attach RPC | `host_session_id`, `amrap_session_id`, `duration_minutes` |
| `interval_wrapper_amrap_start` | `engine.timerPhase` transitions to `'work'` | `host_session_id`, `amrap_session_id`, `role` |
| `interval_wrapper_amrap_round_log` | Participant logs a round | `amrap_session_id`, `participant_id`, `rounds_total` |
| `interval_wrapper_amrap_finished` | `timerPhase` transitions to `'finished'` | `amrap_session_id`, `total_rounds_all_participants` |
| `interval_wrapper_kind_change` | Trainer changes kind | `from_kind`, `to_kind`, `host_session_id` |

---

## 17. Testing Requirements

### Unit

- [ ] `parseAmrapSessionIdFromWrapperConfig` rejects non-UUID strings, `null`, non-objects.
- [ ] `getIntervalWrapper('none')` returns `null`; all registered kinds return a component.
- [ ] `useSocialAmrapEmbedded` with `embedVideo: 'host_session'` does not call `useAgoraChannel`
      (mock/spy on the Agora import).
- [ ] `TimerVideoBackground`: effect does not re-run when only `.rounds` changes on the same leader;
      does re-run when `leaderId` changes to a different participant.

### Integration

- [ ] `host_attach_amrap_session` creates `amrap_sessions` row + updates `host_sessions`; returns
      all three ids; fails with `not_authorised` for non-trainer callers.
- [ ] `host_set_interval_wrapper` rejects calls from non-trainer users.
- [ ] RLS: authenticated client can read `amrap_sessions` for a session they are a participant of;
      cannot write directly to `host_sessions`.

### Manual E2E

- [ ] Two browsers: trainer picks AMRAP → client sees AMRAP panel appear without reload.
- [ ] Single Agora channel confirmed: no second channel join in Agora dashboard logs.
- [ ] Trainer starts timer → client sees same phase within 1 s (Supabase Realtime).
- [ ] Trainer logs round → leaderboard updates; **leader video source does not re-resolve** unless
      leadership changes (watch Network tab for spurious Supabase queries).
- [ ] Guest client refreshes mid-session → claim token path restores participation.
- [ ] Trainer switches `amrap` → `none` confirm dialog fires; cancelling leaves AMRAP running.
- [ ] Render error in `AmrapBody` subtree → `WrapperErrorBoundary` catches; video room unaffected.
- [ ] Six-client seat cap: 7th join is rejected by host join RPC.

---

## 18. Implementation Order

Execute phases in this sequence; each phase leaves the system in a deployable state.

| Phase | Deliverable | Invariants covered |
|---|---|---|
| **P0** | DB migrations: `interval_wrapper_kind`, `interval_wrapper_config`, optional `amrap_sessions.host_session_id`; `host_attach_amrap_session` RPC; extend `join_hints`. | I6 |
| **P1** | `types.ts`, `parseWrapperConfig.ts`, `registry.tsx` (stubs only for tabata/emom); `WrapperErrorBoundary`; `TimerBackgroundContext`; `useExcludeUidForTiles` hook. | I1, I2, I5 |
| **P2** | `SimpleCountdownWrapper` in registry (replaces any existing inline countdown). | I2 |
| **P3** | `useSocialAmrapEmbedded` + embed exports in interval-engine package/app; audit `react-router-dom` `Link` usage. | I1 |
| **P4** | `TimerVideoBackground` with corrected leader dep (I3); `trainerParticipantId` as prop (I4). | I3, I4 |
| **P5** | `AmrapWrapper` component; `SessionRoom` integration; slot contexts; `WrapperErrorBoundary` wrapping. | I2, I5 |
| **P6** | Wrapper-switch confirm dialog; analytics events. | — |
| **P7** | Unit + integration tests; E2E checklist sign-off. | All |

---

## 19. File Layout Reference

```
apps/your-host-app/src/
├── components/
│   ├── SessionRoom.tsx                  # §7
│   ├── TimerVideoBackground.tsx         # §11
│   └── MeLeaderToggle.tsx
├── contexts/
│   ├── AgoraContext.tsx                 # existing; provides localVideoTrack, remoteUsers
│   ├── TimerBackgroundContext.tsx       # §12 (new)
│   ├── SessionDrawerContext.tsx         # portal slot (new)
│   ├── ChatDrawerContext.tsx            # portal slot (new)
│   └── HostNavActionsContext.tsx        # portal slot (new)
├── hooks/
│   └── useExcludeUidForTiles.ts         # §7.1 (new)
└── lib/wrappers/
    ├── types.ts                         # §4
    ├── parseWrapperConfig.ts            # §5
    ├── registry.tsx                     # §6
    ├── WrapperErrorBoundary.tsx         # §8
    ├── simple-countdown/
    │   └── SimpleCountdownWrapper.tsx
    └── amrap/
        └── AmrapWrapper.tsx             # §10

apps/your-interval-engine/src/
└── embed/
    └── index.ts                         # §9 — the only file host app imports from
```
