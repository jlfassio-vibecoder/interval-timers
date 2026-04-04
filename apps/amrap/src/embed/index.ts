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

export { AmrapAuthProvider, useAmrapAuth } from '../contexts/AmrapAuthContext';
export type { AmrapProfile } from '../contexts/AmrapAuthContext';

export { default as AmrapSessionShell } from '../components/amrap-session/AmrapSessionShell';
export type { AmrapSessionShellLayout } from '../components/amrap-session/AmrapSessionShell';

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
export type { TabataSessionShellLayout } from '../components/tabata-session/TabataSessionShell';

export type {
  TabataEngine,
  TabataPhase,
  TabataStateJson,
  TabataSessionRow,
} from '../types/tabata-session';
