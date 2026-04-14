/**
 * Self-contained Build Your Workout flow: duration selection + exercise builder.
 * Used by WorkoutPicker (With Friends) and can be reused elsewhere.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRecentCustomWorkouts,
  saveRecentCustomWorkout,
} from './recentCustomWorkouts';
import type { AmrapBuildTemplate } from './amrap-setup-data';
import {
  createCustomExercise,
  parseToCustomExercise,
  type CustomExercise,
} from './useAmrapSetup';
import { AmrapBuildWorkoutStep } from './AmrapSetupContent';

export interface BuildWorkoutFlowProps {
  onComplete: (durationMinutes: number, workoutList: string[]) => void;
  onBack?: () => void;
  disabled?: boolean;
  /**
   * When set, opens the builder directly with duration + exercises (e.g. Trainer Live session plan).
   * Resets when this object is cleared or `planKey` changes (parent should bump `planKey`).
   */
  initialPlan?: { durationMinutes: number; workoutList: string[] } | null;
  /** Bumped with `initialPlan` so the builder remounts when opening a fresh pre-fill. */
  planKey?: number;
  /**
   * When true (e.g. session plan pre-fill), "Back" from the exercise builder calls `onBack`
   * instead of returning to the duration step — parent can switch to the full protocol UI.
   */
  backFromBuilderTargetsProtocol?: boolean;
}

export function BuildWorkoutFlow({
  onComplete,
  onBack,
  disabled = false,
  initialPlan = null,
  planKey = 0,
  backFromBuilderTargetsProtocol = false,
}: BuildWorkoutFlowProps) {
  const [buildStep, setBuildStep] = useState<'duration' | 'builder'>('duration');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const initialPlanSig = initialPlan
    ? `${planKey}|${initialPlan.durationMinutes}|${initialPlan.workoutList.join('\u0001')}`
    : `${planKey}|`;

  useEffect(() => {
    if (
      initialPlan &&
      initialPlan.workoutList.length > 0 &&
      Number.isFinite(initialPlan.durationMinutes) &&
      initialPlan.durationMinutes >= 1 &&
      initialPlan.durationMinutes <= 180
    ) {
      setSelectedDuration(Math.round(initialPlan.durationMinutes));
      setCustomExercises(initialPlan.workoutList.map(parseToCustomExercise));
      setBuildStep('builder');
    } else {
      setBuildStep('duration');
      setSelectedDuration(null);
      setCustomExercises([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply when pre-fill identity or picker key changes
  }, [initialPlanSig]);

  const handleSelectDuration = useCallback((minutes: number) => {
    setSelectedDuration(minutes);
    setBuildStep('builder');
  }, []);

  const handleAddExercise = useCallback((qty: string, name: string) => {
    const q = qty.trim();
    const n = name.trim();
    if (!n) return;
    setCustomExercises((prev) => [...prev, createCustomExercise(q, n)]);
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
    if (workoutList.length === 0) return;
    saveRecentCustomWorkout(selectedDuration, workoutList);
    onComplete(selectedDuration, workoutList);
  }, [selectedDuration, customExercises, onComplete]);

  const handleBackToDuration = useCallback(() => {
    if (backFromBuilderTargetsProtocol && onBack) {
      onBack();
      return;
    }
    setBuildStep('duration');
  }, [backFromBuilderTargetsProtocol, onBack]);

  const handleLoadTemplate = useCallback(
    (template: AmrapBuildTemplate, options?: { adjustDuration?: number }) => {
      if (options?.adjustDuration != null) {
        setSelectedDuration(options.adjustDuration);
      }
      const parsed = template.exercises.map(parseToCustomExercise);
      setCustomExercises(parsed);
    },
    []
  );

  const handleLoadRecent = useCallback(
    (durationMinutes: number, workoutList: string[]) => {
      setSelectedDuration(durationMinutes);
      setBuildStep('builder');
      const parsed = workoutList.map(parseToCustomExercise);
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
