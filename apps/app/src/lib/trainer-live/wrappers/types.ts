export type TrainerLiveIntervalWrapperKind = 'none' | 'simple_countdown' | 'amrap' | 'tabata';

export interface TrainerLiveWrapperBaseProps {
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  displayName: string;
  authUserId: string | null;
  wrapperConfig: unknown;
  onWrapperError?: (message: string) => void;
  /**
   * Same value as `TrainerLiveVideoShell` `excludeUidForTiles`: that uid is not rendered in video
   * tiles (shown on the interval timer background instead). Timer background must re-`play()` when
   * this flips from null → id — otherwise `TrainerLiveRemoteTile` unmount calls `track.stop()` and
   * the background never recovers (deps `[activeTrack]` alone do not re-run).
   */
  videoTileExcludeUid?: string | null;
}
