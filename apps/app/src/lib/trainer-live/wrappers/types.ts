export type TrainerLiveIntervalWrapperKind = 'none' | 'simple_countdown' | 'amrap';

export interface TrainerLiveWrapperBaseProps {
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  displayName: string;
  authUserId: string | null;
  wrapperConfig: unknown;
  onWrapperError?: (message: string) => void;
}
