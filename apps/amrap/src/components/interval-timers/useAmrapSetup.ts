import { useState, useCallback } from 'react';
import type { AmrapLevel } from './amrap-setup-data';

export type AmrapSetupResult =
  | { type: 'workout'; durationMinutes: number; workoutList: string[] };

export type GeneralBuildStep = 'duration' | 'builder' | null;

export type CustomExercise = { qty: string; name: string };

/**
 * Manages AMRAP setup modal state and completion flow.
 * General = stay in modal, show duration then builder. Workout = start timer with duration and exercise list.
 */
export function useAmrapSetup(onComplete: (result: AmrapSetupResult) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'protocol' | 'workout'>('protocol');
  const [selectedLevel, setSelectedLevel] = useState<AmrapLevel | null>(null);

  // General build flow state (Step 1: duration, Step 2: builder)
  const [generalBuildStep, setGeneralBuildStep] =
    useState<GeneralBuildStep>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  const resetGeneralState = useCallback(() => {
    setGeneralBuildStep(null);
    setSelectedDuration(null);
    setCustomExercises([]);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setStep('protocol');
    setSelectedLevel(null);
    resetGeneralState();
  }, [resetGeneralState]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const back = useCallback(() => {
    if (generalBuildStep === 'builder') {
      setGeneralBuildStep('duration');
      return;
    }
    if (generalBuildStep === 'duration') {
      setStep('protocol');
      resetGeneralState();
      return;
    }
    setStep('protocol');
  }, [generalBuildStep, resetGeneralState]);

  const selectLevel = useCallback((level: AmrapLevel) => {
    setSelectedLevel(level);
    setGeneralBuildStep(null);
    setStep('workout');
  }, []);

  const startWithGeneral = useCallback(() => {
    setStep('workout');
    setGeneralBuildStep('duration');
    setSelectedDuration(null);
    setCustomExercises([]);
  }, []);

  const selectDuration = useCallback((minutes: number) => {
    setSelectedDuration(minutes);
    setGeneralBuildStep('builder');
  }, []);

  const addExercise = useCallback((qty: string, name: string) => {
    setCustomExercises((prev) => [...prev, { qty: qty.trim(), name: name.trim() }]);
  }, []);

  const removeExercise = useCallback((index: number) => {
    setCustomExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const launchFromBuilder = useCallback(() => {
    if (selectedDuration == null) return;
    const workoutList = customExercises
      .map((e) => `${e.qty} ${e.name}`.trim())
      .filter(Boolean);
    onComplete({ type: 'workout', durationMinutes: selectedDuration, workoutList });
    setIsOpen(false);
  }, [selectedDuration, customExercises, onComplete]);

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
    // General build flow
    generalBuildStep,
    selectedDuration,
    customExercises,
    selectDuration,
    addExercise,
    removeExercise,
    launchFromBuilder,
  };
}
