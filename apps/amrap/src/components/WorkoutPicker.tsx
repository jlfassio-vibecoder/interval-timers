import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_PROTOCOL_LABELS,
} from '@/components/interval-timers/amrap-setup-data';
import type { AmrapLevel } from '@/components/interval-timers/amrap-setup-data';

export interface WorkoutPickerProps {
  onSelect: (workoutList: string[], durationMinutes: number) => void;
  onCancel: () => void;
  /** Optional content to render between "Change level" and workout grid when in workout step (e.g. schedule picker) */
  extraContent?: ReactNode;
  disabled?: boolean;
}

export default function WorkoutPicker({
  onSelect,
  onCancel,
  extraContent,
  disabled = false,
}: WorkoutPickerProps) {
  const [step, setStep] = useState<'level' | 'workout'>('level');
  const [selectedLevel, setSelectedLevel] = useState<AmrapLevel | null>(null);

  const workouts = selectedLevel ? AMRAP_WORKOUT_LIBRARY[selectedLevel] : [];
  const duration = selectedLevel ? AMRAP_LEVEL_DURATION[selectedLevel] : 15;

  const handleCancel = () => {
    setStep('level');
    setSelectedLevel(null);
    onCancel();
  };

  if (step === 'level') {
    return (
      <div>
        <p className="mb-4 text-sm text-white/70">
          Choose a level, then pick a workout.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                setSelectedLevel(level);
                setStep('workout');
              }}
              disabled={disabled}
              className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="font-bold text-white">
                {AMRAP_PROTOCOL_LABELS[level]}
              </div>
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
    <div>
      <button
        type="button"
        onClick={() => {
          setStep('level');
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
            className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10 disabled:opacity-50 disabled:pointer-events-none"
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
