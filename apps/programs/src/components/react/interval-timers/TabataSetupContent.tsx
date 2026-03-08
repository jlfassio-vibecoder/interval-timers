import React from 'react';
import { WORKOUT_DATABASE, TABATA_PROTOCOL_LABELS } from './interval-timer-setup-data';
import type { TabataWorkoutCategory } from './interval-timer-setup-data';
import { TABATA_DEFAULT_CYCLES } from './interval-timer-setup-data';

/** Protocol step: Standard Tabata button + four category buttons. */
export interface TabataProtocolStepProps {
  onStartWithStandard: () => void;
  onSelectCategory: (category: TabataWorkoutCategory) => void;
}

export function TabataProtocolStep({
  onStartWithStandard,
  onSelectCategory,
}: TabataProtocolStepProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onStartWithStandard}
        className="hover:bg-orange-light/10 group flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-light"
      >
        <div>
          <div className="text-lg font-bold text-white group-hover:text-orange-light">
            {TABATA_PROTOCOL_LABELS.standardTabata}
          </div>
          <div className="mt-1 text-xs font-medium text-white/70">
            {TABATA_PROTOCOL_LABELS.standardTabataDesc}
          </div>
        </div>
        <div className="text-2xl opacity-50 transition-transform group-hover:scale-110 group-hover:opacity-100">
          🔥
        </div>
      </button>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelectCategory('single')}
          className="hover:bg-orange-light/10 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-light"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.singleExercise}</div>
          <div className="text-[10px] text-white/70">
            {TABATA_PROTOCOL_LABELS.singleExerciseDesc}
          </div>
        </button>
        <button
          onClick={() => onSelectCategory('alternating')}
          className="hover:bg-orange-light/10 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-light"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.alternating}</div>
          <div className="text-[10px] text-white/70">{TABATA_PROTOCOL_LABELS.alternatingDesc}</div>
        </button>
        <button
          onClick={() => onSelectCategory('circuit4')}
          className="hover:bg-orange-light/10 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-light"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.circuit4}</div>
          <div className="text-[10px] text-white/70">{TABATA_PROTOCOL_LABELS.circuit4Desc}</div>
        </button>
        <button
          onClick={() => onSelectCategory('circuit8')}
          className="hover:bg-orange-light/10 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-light"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.circuit8}</div>
          <div className="text-[10px] text-white/70">{TABATA_PROTOCOL_LABELS.circuit8Desc}</div>
        </button>
      </div>
    </div>
  );
}

/** Workout step: grid of workouts for the selected category. */
export interface TabataWorkoutStepProps {
  selectedCategory: TabataWorkoutCategory | null;
  onStartWithWorkout: (cycles: number, list: string[]) => void;
}

export function TabataWorkoutStep({
  selectedCategory,
  onStartWithWorkout,
}: TabataWorkoutStepProps) {
  return (
    <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
      {selectedCategory &&
        WORKOUT_DATABASE[selectedCategory].map((option, idx) => (
          <button
            key={idx}
            onClick={() => onStartWithWorkout(TABATA_DEFAULT_CYCLES, [...option.list])}
            className="hover:bg-orange-light/10 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-light"
          >
            <div className="font-bold text-white">{option.name}</div>
            <div className="mt-1 line-clamp-1 text-[10px] text-white/70">
              {option.list.join(' / ')}
            </div>
          </button>
        ))}
    </div>
  );
}
