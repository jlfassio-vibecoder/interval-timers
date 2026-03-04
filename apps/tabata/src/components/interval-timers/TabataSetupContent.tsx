import { WORKOUT_DATABASE, TABATA_PROTOCOL_LABELS } from './interval-timer-setup-data';
import type { TabataWorkoutCategory } from './interval-timer-setup-data';
import { TABATA_DEFAULT_CYCLES } from './interval-timer-setup-data';

/** Protocol step: warm-up choice + Standard Tabata button + four category buttons. */
export interface TabataProtocolStepProps {
  includeWarmup: boolean;
  onIncludeWarmupChange: (value: boolean) => void;
  onStartWithStandard: () => void;
  onSelectCategory: (category: TabataWorkoutCategory) => void;
}

export function TabataProtocolStep({
  includeWarmup,
  onIncludeWarmupChange,
  onStartWithStandard,
  onSelectCategory,
}: TabataProtocolStepProps) {
  return (
    <div className="space-y-4">
      {/* Before you start: optional Daily Warm-Up */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h3 className="mb-1 font-bold text-white">Before you start</h3>
        <p className="mb-3 text-xs text-white/70">
          Daily Warm-Up prepares joints and muscles. Recommended before high-intensity intervals.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onIncludeWarmupChange(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              includeWarmup
                ? 'border-[#ffbf00] bg-[#ffbf00]/20 text-[#ffbf00]'
                : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
            }`}
          >
            Include Warm-Up (~14 min)
          </button>
          <button
            type="button"
            onClick={() => onIncludeWarmupChange(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              !includeWarmup
                ? 'border-[#ffbf00] bg-[#ffbf00]/20 text-[#ffbf00]'
                : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
            }`}
          >
            Skip, go straight to Tabata
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartWithStandard}
        className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#ffbf00] hover:bg-[#ffbf00]/10"
      >
        <div>
          <div className="text-lg font-bold text-white group-hover:text-[#ffbf00]">
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
          type="button"
          onClick={() => onSelectCategory('single')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#ffbf00] hover:bg-[#ffbf00]/10"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.singleExercise}</div>
          <div className="text-[10px] text-white/70">
            {TABATA_PROTOCOL_LABELS.singleExerciseDesc}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelectCategory('alternating')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#ffbf00] hover:bg-[#ffbf00]/10"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.alternating}</div>
          <div className="text-[10px] text-white/70">{TABATA_PROTOCOL_LABELS.alternatingDesc}</div>
        </button>
        <button
          type="button"
          onClick={() => onSelectCategory('circuit4')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#ffbf00] hover:bg-[#ffbf00]/10"
        >
          <div className="mb-1 font-bold text-white">{TABATA_PROTOCOL_LABELS.circuit4}</div>
          <div className="text-[10px] text-white/70">{TABATA_PROTOCOL_LABELS.circuit4Desc}</div>
        </button>
        <button
          type="button"
          onClick={() => onSelectCategory('circuit8')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#ffbf00] hover:bg-[#ffbf00]/10"
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
        WORKOUT_DATABASE[selectedCategory].map((option) => (
          <button
            type="button"
            key={option.name}
            onClick={() => onStartWithWorkout(TABATA_DEFAULT_CYCLES, [...option.list])}
            className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-[#ffbf00] hover:bg-[#ffbf00]/10"
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
