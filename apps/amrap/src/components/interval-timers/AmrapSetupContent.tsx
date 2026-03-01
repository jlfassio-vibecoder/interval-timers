import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_PROTOCOL_LABELS,
} from './amrap-setup-data';
import type { AmrapLevel } from './amrap-setup-data';

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
