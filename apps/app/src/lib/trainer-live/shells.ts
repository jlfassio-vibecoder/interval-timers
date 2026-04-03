export type TrainerLiveShell = 'video_only' | 'countdown_timer';

export const TRAINER_LIVE_SHELLS: TrainerLiveShell[] = ['video_only', 'countdown_timer'];

export function parseTrainerLiveShell(value: string | null | undefined): TrainerLiveShell {
  if (value === 'countdown_timer') return 'countdown_timer';
  return 'video_only';
}
