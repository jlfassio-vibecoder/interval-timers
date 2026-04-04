import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_PROTOCOL_LABELS,
} from './amrap-setup-data';
import { BuildWorkoutFlow } from './BuildWorkoutFlow';
import type { AmrapLevel } from './amrap-setup-data';

/** Trainer library row (e.g. `public.workouts`) for the saved-workouts path. */
export interface AmrapSavedWorkoutItem {
  id: string;
  title: string;
  blocks: unknown;
  durationMinutes?: number | null;
  source?: string;
}

export interface AmrapWorkoutPickerProps {
  onSelect: (workoutList: string[], durationMinutes: number) => void;
  onCancel: () => void;
  /** Optional content between "Change level" and workout grid when in workout step */
  extraContent?: ReactNode;
  disabled?: boolean;
  /** Root wrapper class (e.g. Mission Control modal theming) */
  className?: string;
  /**
   * When set (including `[]`), show "My saved workouts" on the protocol step.
   * Parent fetches trainer `public.workouts` and maps blocks + duration; confirm runs `onConfirmSavedWorkout`.
   */
  savedWorkouts?: AmrapSavedWorkoutItem[];
  /** After user confirms duration for a saved row; parent maps blocks → attach RPC inputs. */
  onConfirmSavedWorkout?: (item: AmrapSavedWorkoutItem, durationMinutes: number) => void;
}

type Step = 'protocol' | 'level' | 'workout' | 'build' | 'saved';

export function AmrapWorkoutPicker({
  onSelect,
  onCancel,
  extraContent,
  disabled = false,
  className,
  savedWorkouts,
  onConfirmSavedWorkout,
}: AmrapWorkoutPickerProps) {
  const [step, setStep] = useState<Step>('protocol');
  const [selectedLevel, setSelectedLevel] = useState<AmrapLevel | null>(null);
  const [savedPhase, setSavedPhase] = useState<'list' | 'confirm'>('list');
  const [selectedSaved, setSelectedSaved] = useState<AmrapSavedWorkoutItem | null>(null);
  const [savedDurationInput, setSavedDurationInput] = useState('15');

  const workouts = selectedLevel ? AMRAP_WORKOUT_LIBRARY[selectedLevel] : [];
  const duration = selectedLevel ? AMRAP_LEVEL_DURATION[selectedLevel] : 15;

  const handleCancel = () => {
    setStep('protocol');
    setSelectedLevel(null);
    setSavedPhase('list');
    setSelectedSaved(null);
    onCancel();
  };

  const handleBuildComplete = (durationMinutes: number, workoutList: string[]) => {
    onSelect(workoutList, durationMinutes);
  };

  const rootClass = className ? className : '';

  const showSavedEntry =
    savedWorkouts !== undefined && typeof onConfirmSavedWorkout === 'function';

  if (step === 'build') {
    return (
      <div className={rootClass}>
        <BuildWorkoutFlow
          onComplete={handleBuildComplete}
          onBack={() => setStep('protocol')}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleCancel}
          className="mt-4 text-sm font-medium text-white/60 hover:text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (step === 'saved') {
    if (savedPhase === 'confirm' && selectedSaved) {
      const parsed = parseInt(savedDurationInput, 10);
      const durationOk = Number.isFinite(parsed) && parsed >= 1 && parsed <= 180;
      return (
        <div className={rootClass}>
          <button
            type="button"
            onClick={() => {
              setSavedPhase('list');
              setSelectedSaved(null);
            }}
            disabled={disabled}
            className="mb-4 text-sm font-medium text-white/60 hover:text-white disabled:opacity-50"
          >
            ← Back to list
          </button>
          <p className="mb-2 font-bold text-white">{selectedSaved.title}</p>
          {selectedSaved.source === 'ai_factory' ? (
            <p className="mb-3 text-[10px] uppercase tracking-wide text-orange-light/90">AI</p>
          ) : null}
          <label className="mb-1 block text-[10px] font-mono uppercase text-white/50">
            Duration (minutes)
          </label>
          <input
            type="number"
            min={1}
            max={180}
            value={savedDurationInput}
            onChange={(e) => setSavedDurationInput(e.target.value)}
            disabled={disabled}
            className="mb-4 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <button
            type="button"
            disabled={disabled || !durationOk}
            onClick={() => {
              if (!durationOk || !onConfirmSavedWorkout) return;
              onConfirmSavedWorkout(selectedSaved, parsed);
            }}
            className="w-full rounded-xl border border-orange-light/40 bg-orange-light/15 py-3 font-bold text-orange-light hover:bg-orange-light/25 disabled:opacity-40"
          >
            Use for AMRAP
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="mt-4 w-full text-sm font-medium text-white/60 hover:text-white"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className={rootClass}>
        <button
          type="button"
          onClick={() => {
            setStep('protocol');
            setSavedPhase('list');
            setSelectedSaved(null);
          }}
          disabled={disabled}
          className="mb-4 text-sm font-medium text-white/60 hover:text-white disabled:opacity-50"
        >
          ← Back
        </button>
        <p className="mb-3 text-sm text-white/70">Choose a workout from your Mission Control library.</p>
        {savedWorkouts!.length === 0 ? (
          <p className="text-sm text-white/50">No saved workouts yet. Save from Workout Factory first.</p>
        ) : (
          <div className="grid max-h-[45vh] grid-cols-1 gap-2 overflow-y-auto">
            {savedWorkouts!.map((item) => {
              const label =
                item.source === 'ai_factory' ? `${item.title} (AI)` : item.title;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelectedSaved(item);
                    const d =
                      typeof item.durationMinutes === 'number' &&
                      Number.isFinite(item.durationMinutes) &&
                      item.durationMinutes >= 1 &&
                      item.durationMinutes <= 180
                        ? String(Math.round(item.durationMinutes))
                        : '15';
                    setSavedDurationInput(d);
                    setSavedPhase('confirm');
                  }}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="font-bold text-white">{label}</div>
                  {item.durationMinutes != null ? (
                    <div className="mt-1 text-[10px] text-white/60">
                      {item.durationMinutes} min (default)
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={handleCancel}
          className="mt-4 text-sm font-medium text-white/60 hover:text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (step === 'protocol') {
    return (
      <div className={rootClass}>
        <p className="mb-4 text-sm text-white/70">
          Choose a level, build your own, or use a saved library workout.
        </p>
        {showSavedEntry ? (
          <button
            type="button"
            onClick={() => {
              setStep('saved');
              setSavedPhase('list');
              setSelectedSaved(null);
            }}
            disabled={disabled}
            className="mb-4 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <div>
              <div className="font-bold text-white">My saved workouts</div>
              <div className="mt-1 text-[10px] text-white/70">
                From your trainer library (Mission Control / Workout Factory)
              </div>
            </div>
            <span className="text-xs font-mono uppercase text-white/40">Lib</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setStep('build')}
          disabled={disabled}
          className="mb-4 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:pointer-events-none disabled:opacity-50"
        >
          <div>
            <div className="font-bold text-white">{AMRAP_PROTOCOL_LABELS.generalAmrap}</div>
            <div className="mt-1 text-[10px] text-white/70">
              {AMRAP_PROTOCOL_LABELS.generalAmrapDesc}
            </div>
          </div>
          <span className="text-2xl opacity-50">⏱️</span>
        </button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                setSelectedLevel(level);
                setStep('level');
              }}
              disabled={disabled}
              className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="font-bold text-white">{AMRAP_PROTOCOL_LABELS[level]}</div>
              <div className="mt-1 text-[10px] text-white/70">
                {AMRAP_PROTOCOL_LABELS[`${level}Desc` as keyof typeof AMRAP_PROTOCOL_LABELS]}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="mt-4 text-sm font-medium text-white/60 hover:text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <button
        type="button"
        onClick={() => {
          setStep('protocol');
          setSelectedLevel(null);
        }}
        disabled={disabled}
        className="mb-4 text-sm font-medium text-white/60 hover:text-white disabled:opacity-50"
      >
        ← Change level
      </button>
      {extraContent && <div className="mb-4">{extraContent}</div>}
      <div className="grid max-h-[40vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
        {workouts.map((option) => (
          <button
            key={option.name}
            type="button"
            disabled={disabled}
            onClick={() => onSelect([...option.exercises], duration)}
            className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <div className="font-bold text-white">{option.name}</div>
            <div className="mt-1 line-clamp-2 text-[10px] text-white/70">
              {option.exercises.join(' → ')}
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleCancel}
        className="mt-4 text-sm font-medium text-white/60 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
