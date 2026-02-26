import { useState, useCallback } from 'react';
import type { TabataSetupResult, TabataWorkoutCategory } from './interval-timer-setup-data';
import { TABATA_DEFAULT_CYCLES } from './interval-timer-setup-data';

/**
 * Manages Tabata setup modal state and completion flow.
 * Caller renders the modal and protocol/workout content; this hook only owns state and callbacks.
 */
export function useTabataSetup(onComplete: (result: TabataSetupResult) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'protocol' | 'workout'>('protocol');
  const [selectedCategory, setSelectedCategory] = useState<TabataWorkoutCategory | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setStep('protocol');
    setSelectedCategory(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const back = useCallback(() => {
    setStep('protocol');
  }, []);

  const selectCategory = useCallback((category: TabataWorkoutCategory) => {
    setSelectedCategory(category);
    setStep('workout');
  }, []);

  const startWithStandard = useCallback(() => {
    onComplete({ cycles: TABATA_DEFAULT_CYCLES, workoutList: [] });
    setIsOpen(false);
  }, [onComplete]);

  const startWithWorkout = useCallback(
    (cycles: number, list: string[]) => {
      onComplete({ cycles, workoutList: list });
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
    selectCategory,
    selectedCategory,
    startWithStandard,
    startWithWorkout,
  };
}
