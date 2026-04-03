import type { TrainerLiveIntervalWrapperKind } from './types';

export function parseIntervalWrapperKind(
  raw: string | null | undefined
): TrainerLiveIntervalWrapperKind {
  if (raw === 'simple_countdown' || raw === 'amrap' || raw === 'none') return raw;
  return 'none';
}
