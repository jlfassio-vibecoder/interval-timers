import React, { useEffect, useState } from 'react';
import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_PROTOCOL_LABELS,
} from './amrap-setup-data';
import type { AmrapLevel } from './amrap-setup-data';
import type { CustomExercise } from './useAmrapSetup';

/** Protocol step: General AMRAP + three level buttons (Beginner, Intermediate, Advanced). */
export interface AmrapProtocolStepProps {
  onStartWithGeneral: () => void;
  onSelectLevel: (level: AmrapLevel) => void;
}

export function AmrapProtocolStep({
  onStartWithGeneral,
  onSelectLevel,
}: AmrapProtocolStepProps) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onStartWithGeneral}
        className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
      >
        <div>
          <div className="text-lg font-bold text-white group-hover:text-orange-400">
            {AMRAP_PROTOCOL_LABELS.generalAmrap}
          </div>
          <div className="mt-1 text-xs font-medium text-white/70">
            {AMRAP_PROTOCOL_LABELS.generalAmrapDesc}
          </div>
        </div>
        <div className="text-2xl opacity-50 transition-transform group-hover:scale-110 group-hover:opacity-100">
          ⏱️
        </div>
      </button>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelectLevel('beginner')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="mb-1 font-bold text-white">{AMRAP_PROTOCOL_LABELS.beginner}</div>
          <div className="text-[10px] text-white/70">{AMRAP_PROTOCOL_LABELS.beginnerDesc}</div>
        </button>
        <button
          type="button"
          onClick={() => onSelectLevel('intermediate')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="mb-1 font-bold text-white">
            {AMRAP_PROTOCOL_LABELS.intermediate}
          </div>
          <div className="text-[10px] text-white/70">
            {AMRAP_PROTOCOL_LABELS.intermediateDesc}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelectLevel('advanced')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="mb-1 font-bold text-white">{AMRAP_PROTOCOL_LABELS.advanced}</div>
          <div className="text-[10px] text-white/70">{AMRAP_PROTOCOL_LABELS.advancedDesc}</div>
        </button>
      </div>
    </div>
  );
}

/** Workout step: grid of workouts for the selected level. */
export interface AmrapWorkoutStepProps {
  selectedLevel: AmrapLevel | null;
  onStartWithWorkout: (durationMinutes: number, workoutList: string[]) => void;
}

export function AmrapWorkoutStep({
  selectedLevel,
  onStartWithWorkout,
}: AmrapWorkoutStepProps) {
  if (!selectedLevel) return null;

  const duration = AMRAP_LEVEL_DURATION[selectedLevel];
  const workouts = AMRAP_WORKOUT_LIBRARY[selectedLevel];

  return (
    <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
      {workouts.map((option) => (
        <button
          type="button"
          key={option.name}
          onClick={() => onStartWithWorkout(duration, [...option.exercises])}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="font-bold text-white">{option.name}</div>
          <div className="mt-1 line-clamp-2 text-[10px] text-white/70">
            {option.exercises.join(' → ')}
          </div>
        </button>
      ))}
    </div>
  );
}

/** General build flow: Step 1 (Duration) and Step 2 (Builder) with qty/name inputs. */
export interface AmrapBuildWorkoutStepProps {
  buildStep: 'duration' | 'builder';
  selectedDuration: number | null;
  customExercises: CustomExercise[];
  onSelectDuration: (minutes: number) => void;
  onAddExercise: (qty: string, name: string) => void;
  onRemoveExercise: (index: number) => void;
  onLaunch: () => void;
  onBackToDuration: () => void;
  qtyInputRef: React.RefObject<HTMLInputElement | null>;
}

export function AmrapBuildWorkoutStep({
  buildStep,
  selectedDuration,
  customExercises,
  onSelectDuration,
  onAddExercise,
  onRemoveExercise,
  onLaunch,
  onBackToDuration,
  qtyInputRef,
}: AmrapBuildWorkoutStepProps) {
  const [qty, setQty] = useState('');
  const [name, setName] = useState('');

  // Focus qty input when transitioning to builder sub-step
  useEffect(() => {
    if (buildStep === 'builder' && selectedDuration != null) {
      const t = requestAnimationFrame(() => {
        qtyInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(t);
    }
  }, [buildStep, selectedDuration, qtyInputRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = qty.trim();
    const n = name.trim();
    if (q || n) {
      onAddExercise(q || '', n || '');
      setQty('');
      setName('');
      requestAnimationFrame(() => qtyInputRef.current?.focus());
    }
  };

  if (buildStep === 'duration') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onSelectDuration(5)}
          className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/20"
        >
          <div className="text-lg font-bold text-white">Sprint (5 Mins)</div>
          <div className="text-xs font-medium text-white/60">
            High intensity, zero rest
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelectDuration(15)}
          className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/20"
        >
          <div className="text-lg font-bold text-white">Standard (15 Mins)</div>
          <div className="text-xs font-medium text-white/60">
            Classic CrossFit time domain
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelectDuration(20)}
          className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/20"
        >
          <div className="text-lg font-bold text-white">Endurance (20 Mins)</div>
          <div className="text-xs font-medium text-white/60">
            Pacing is critical
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBackToDuration}
        className="text-sm text-white/60 hover:text-orange-400"
      >
        ← Back to duration
      </button>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          ref={qtyInputRef}
          type="text"
          inputMode="numeric"
          placeholder="15"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-16 rounded-lg border border-white/20 bg-black/30 px-2.5 py-2 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          aria-label="Quantity"
        />
        <input
          type="text"
          placeholder="burpees"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[8rem] flex-1 rounded-lg border border-white/20 bg-black/30 px-2.5 py-2 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          aria-label="Exercise name"
        />
        <button
          type="submit"
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_12px_rgba(234,88,12,0.3)] transition-all hover:bg-orange-500"
          aria-label="Add exercise"
        >
          +
        </button>
      </form>

      {customExercises.length === 0 ? (
        <p className="text-sm text-white/50">No exercises yet — add some or launch blank timer.</p>
      ) : (
        <ul className="grid max-h-[30vh] grid-cols-1 gap-3 overflow-y-auto">
          {customExercises.map((ex, i) => {
            const reps = ex.qty || null;
            const displayName = ex.name || '?';
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <span className="text-white/50">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium text-white">
                  {displayName}
                </span>
                {reps != null && reps !== '' && (
                  <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-sm font-medium text-white/80">
                    {reps}
                    {/\d$/.test(reps) ? ` rep${reps === '1' ? '' : 's'}` : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveExercise(i)}
                  className="shrink-0 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label={`Remove ${displayName}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onLaunch}
        className="w-full rounded-xl bg-orange-600 px-6 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-all hover:bg-orange-500"
      >
        {customExercises.length === 0
          ? 'Launch Blank Timer'
          : 'Launch Custom AMRAP'}
      </button>
    </div>
  );
}
