/**
 * Public entry for embedding social AMRAP inside Trainer Live (or other hosts).
 *
 * **Requires `AmrapAuthProvider`** (re-exported from this module) above the tree that
 * calls `useSocialAmrapEmbedded`.
 *
 * **Router:** `useSocialAmrap` uses `react-router-dom` `Link`; the host app should
 * provide a compatible Router, or links may error at runtime until an embed-specific
 * variant exists.
 *
 * Import from the app: `import { useSocialAmrapEmbedded, useTabataEmbedded } from 'amrap/embed'`
 * (see `apps/app` Vite config: `@/` inside `apps/amrap` resolves to amrap `src`).
 */
import {
  useSocialAmrap,
  type UseSocialAmrapOptions,
} from '../hooks/useSocialAmrap';

export type {
  AmrapSessionEngine,
  AmrapTimerPhase,
  AmrapParticipantEngine,
} from '../types/amrap-session';
export type { AmrapSplitRecord } from '../lib/amrapSplitTypes';

export { AmrapAuthProvider, useAmrapAuth } from '../contexts/AmrapAuthContext';
export type { AmrapProfile } from '../contexts/AmrapAuthContext';

export { default as AmrapSessionShell } from '../components/amrap-session/AmrapSessionShell';
export type { AmrapSessionShellLayout } from '../components/amrap-session/AmrapSessionShell';
export { default as AmrapEmbedExerciseSection } from '../components/amrap-session/AmrapEmbedExerciseSection';

/** Trainer Live embed mounts this next to `AmrapSessionShell` (full-page AMRAP uses `AmrapSessionPage`). */
export { default as ViewResultsModal } from '../components/ViewResultsModal';

/** Persist AMRAP host credentials after `trainer_live_attach_amrap_session` (same keys as standalone AMRAP). */
export {
  setStoredHostToken,
  setStoredParticipantId,
} from '../hooks/useAmrapSession';

export type UseSocialAmrapEmbeddedOptions = Omit<
  UseSocialAmrapOptions,
  'skipAgora'
> & {
  amrapSessionId: string;
  /** Must be `'trainer_live'`; single supported embed mode (no AMRAP Agora channel). */
  embedVideo: 'trainer_live';
  /** Passed through to `useSocialAmrap` for client auto-join (see `trainerLiveJoinNickname` there). */
  trainerLiveJoinNickname?: string;
};

export function useSocialAmrapEmbedded(
  options: UseSocialAmrapEmbeddedOptions
): ReturnType<typeof useSocialAmrap> {
  const { amrapSessionId, embedVideo, ...rest } = options;
  if (embedVideo !== 'trainer_live') {
    throw new Error(
      `useSocialAmrapEmbedded: unsupported embedVideo "${String(embedVideo)}", expected "trainer_live"`
    );
  }
  return useSocialAmrap(amrapSessionId, {
    ...rest,
    skipAgora: true,
    /** Room chat is provided by Trainer Live; keep standalone AMRAP layout unchanged. */
    hideMessageBoard: rest.hideMessageBoard ?? true,
    /** Who's Here is shown in the Trainer Live Session drawer, not above the leaderboard. */
    whosHereInSessionDrawer: rest.whosHereInSessionDrawer ?? true,
    /** Host actions go to Trainer Live nav bar, not the exercise column. */
    trainerLiveHostNavActions: rest.trainerLiveHostNavActions ?? true,
    /** AMRAP leaderboard below chat in Trainer Live chat drawer. */
    trainerLiveChatDrawerLeaderboard: rest.trainerLiveChatDrawerLeaderboard ?? true,
  });
}

// --- Tabata (Trainer Live embed; no Agora) ---

export {
  useTabataEmbedded,
  parseTabataState,
  computeTabataRemainingSec,
} from '../hooks/useTabataEmbedded';
export type { UseTabataEmbeddedOptions } from '../hooks/useTabataEmbedded';

export { default as TabataSessionShell } from '../components/tabata-session/TabataSessionShell';
export type {
  TabataSessionShellLayout,
  TabataSessionShellProps,
} from '../components/tabata-session/TabataSessionShell';

export { default as TabataEmbedExerciseSection } from '../components/tabata-session/TabataEmbedExerciseSection';

export type {
  TabataEngine,
  TabataPhase,
  TabataStateJson,
  TabataSessionRow,
} from '../types/tabata-session';
