import type { ComponentType } from 'react';
import type { TrainerLiveIntervalWrapperKind, TrainerLiveWrapperBaseProps } from './types';
import TrainerLiveAmrapWrapper from './amrap/TrainerLiveAmrapWrapper';

type WrapperComponent = ComponentType<TrainerLiveWrapperBaseProps>;

const registry: Partial<Record<TrainerLiveIntervalWrapperKind, WrapperComponent>> = {
  amrap: TrainerLiveAmrapWrapper,
};

export function getTrainerLiveIntervalWrapper(
  kind: TrainerLiveIntervalWrapperKind
): WrapperComponent | null {
  return registry[kind] ?? null;
}
