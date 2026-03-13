/**
 * Self-contained Build Your Workout flow: duration selection + exercise builder.
 * Used by WorkoutPicker (With Friends) and can be reused elsewhere.
 */
import { useCallback, useRef, useState } from 'react';
import {
  getRecentCustomWorkouts,
  saveRecentCustomWorkout,
} from '@/lib/recentCustomWorkouts';
import type { AmrapBuildTemplate } from './amrap-setup-data';
import type { CustomExercise } from './useAmrapSetup';
import { AmrapBuildWorkoutStep } from './AmrapSetupContent';

export interface BuildWorkoutFlowProps {
  onComplete: (durationMinutes: number, workoutList: string[]) => void;
  onBack?: () => void;
  disabled?: boolean;
}

export function BuildWorkoutFlow({
  onComplete,
  onBack,
  disabled = false,
}: BuildWorkoutFlowProps) {
  const [buildStep, setBuildStep] = useState<'duration' | 'builder'>('duration');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectDuration = useCallback((minutes: number) => {
    setSelectedDuration(minutes);
    setBuildStep('builder');
  }, []);

  const handleAddExercise = useCallback((qty: string, name: string) => {
    const q = qty.trim();
    const n = name.trim();
    if (!n) return;
    setCustomExercises((prev) => [...prev, { qty: q, name: n }]);
  }, []);

  const handleRemoveExercise = useCallback((index: number) => {
    setCustomExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReorderExercises = useCallback((fromIndex: number, toIndex: number) => {
    setCustomExercises((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length)
        return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed!);
      return next;
    });
  }, []);

  const handleLaunch = useCallback(() => {
    if (selectedDuration == null) return;
    const workoutList = customExercises
      .map((e) => `${e.qty} ${e.name}`.trim())
      .filter(Boolean);
    saveRecentCustomWorkout(selectedDuration, workoutList);
    onComplete(selectedDuration, workoutList);
  }, [selectedDuration, customExercises, onComplete]);

  const handleBackToDuration = useCallback(() => {
    setBuildStep('duration');
  }, []);

  const handleLoadTemplate = useCallback(
    (template: AmrapBuildTemplate, options?: { adjustDuration?: number }) => {
      if (options?.adjustDuration != null) {
        setSelectedDuration(options.adjustDuration);
      }
      const parsed: CustomExercise[] = template.exercises.map((ex) => {
        const match = ex.trim().match(/^(\d+(?:-\d+)?m?)\s+(.+)$/);
        if (match) return { qty: match[1], name: match[2].trim() };
        return { qty: '', name: ex.trim() };
      });
      setCustomExercises(parsed);
    },
    []
  );

  const handleLoadRecent = useCallback(
    (durationMinutes: number, workoutList: string[]) => {
      setSelectedDuration(durationMinutes);
      setBuildStep('builder');
      const parsed: CustomExercise[] = workoutList.map((ex) => {
        const match = ex.trim().match(/^(\d+(?:-\d+)?m?)\s+(.+)$/);
        if (match) return { qty: match[1], name: match[2].trim() };
        return { qty: '', name: ex.trim() };
      });
      setCustomExercises(parsed);
    },
    []
  );

  const recentWorkouts = buildStep === 'builder' ? getRecentCustomWorkouts() : [];

  const handleBackToProtocol = useCallback(() => {
    if (onBack) onBack();
  }, [onBack]);

  return (
    <div className="space-y-4">
      {buildStep === 'duration' && onBack && (
        <button
          type="button"
          onClick={handleBackToProtocol}
          disabled={disabled}
          className="mb-2 text-sm text-white/60 hover:text-orange-400 disabled:opacity-50"
        >
          ← Back
        </button>
      )}
      <AmrapBuildWorkoutStep
        buildStep={buildStep}
        selectedDuration={selectedDuration}
        customExercises={customExercises}
        onSelectDuration={handleSelectDuration}
        onAddExercise={handleAddExercise}
        onRemoveExercise={handleRemoveExercise}
        onReorderExercises={handleReorderExercises}
        onLoadTemplate={handleLoadTemplate}
        onLoadRecent={handleLoadRecent}
        recentWorkouts={recentWorkouts}
        onLaunch={handleLaunch}
        onBackToDuration={handleBackToDuration}
        qtyInputRef={qtyInputRef}
      />
    </div>
  );
}
