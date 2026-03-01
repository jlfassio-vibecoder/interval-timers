import { useState, useCallback } from 'react';
import type { AmrapLevel } from './amrap-setup-data';

export type AmrapSetupResult =
  | { type: 'general' }
  | { type: 'workout'; durationMinutes: number; workoutList: string[] };

/**
 * Manages AMRAP setup modal state and completion flow.
 * General = close modal, scroll to simulator (parent handles). Workout = start timer with duration and exercise list.
 */
export function useAmrapSetup(onComplete: (result: AmrapSetupResult) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'protocol' | 'workout'>('protocol');
  const [selectedLevel, setSelectedLevel] = useState<AmrapLevel | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setStep('protocol');
    setSelectedLevel(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const back = useCallback(() => {
    setStep('protocol');
  }, []);

  const selectLevel = useCallback((level: AmrapLevel) => {
    setSelectedLevel(level);
    setStep('workout');
  }, []);

  const startWithGeneral = useCallback(() => {
    onComplete({ type: 'general' });
    setIsOpen(false);
  }, [onComplete]);

  const startWithWorkout = useCallback(
    (durationMinutes: number, workoutList: string[]) => {
      onComplete({ type: 'workout', durationMinutes, workoutList });
      setIsOpen(false);
    },
    [onComplete]
  );

  return {
    isOpen,
    step,
    open,
    close,
    back,
    selectLevel,
    selectedLevel,
    startWithGeneral,
    startWithWorkout,
  };
}
