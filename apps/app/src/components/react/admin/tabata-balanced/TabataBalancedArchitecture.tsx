/**
 * Balanced Strength & Cardio Tabata: fixed 20s/10s, pairing presets, adjustable round count.
 */

import React from 'react';
import type { TabataBalancedPairingPattern } from '@/types/ai-workout';
import {
  TABATA_BALANCED_MAX_ROUNDS,
  TABATA_BALANCED_MIN_ROUNDS,
  tabataBalancedExerciseCount,
  tabataBalancedSessionMinutes,
} from '@/lib/tabata-balanced-duration';

const PAIRING_OPTIONS: {
  value: TabataBalancedPairingPattern;
  label: string;
  detail: string;
}[] = [
  {
    value: 'single',
    label: 'Single exercise',
    detail: 'All work intervals on one movement — hardest; scale load or regression for clients.',
  },
  {
    value: 'antagonist_pair',
    label: 'Push / pull (antagonist)',
    detail: 'Alternate two patterns (e.g. press + row) for balance and active recovery between efforts.',
  },
  {
    value: 'agonist_pair',
    label: 'Same group, two moves (agonist)',
    detail: 'Two different exercises for the same muscle group to build local endurance.',
  },
  {
    value: 'four_station',
    label: 'Four exercises',
    detail: 'Rotate through four movements in order; repeats until all rounds are complete.',
  },
  {
    value: 'eight_station',
    label: 'Eight exercises',
    detail: 'One distinct exercise per work interval (full rotation through eight moves).',
  },
];

export interface TabataBalancedArchitectureProps {
  pairingPattern: TabataBalancedPairingPattern;
  roundCount: number;
  onPairingPatternChange: (p: TabataBalancedPairingPattern) => void;
  onRoundCountChange: (n: number) => void;
}

const TabataBalancedArchitecture: React.FC<TabataBalancedArchitectureProps> = ({
  pairingPattern,
  roundCount,
  onPairingPatternChange,
  onRoundCountChange,
}) => {
  const nEx = tabataBalancedExerciseCount(pairingPattern);
  const roundsValid = nEx <= 1 || roundCount % nEx === 0;
  const sessionMin = tabataBalancedSessionMinutes(roundCount);

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-bold text-white">Tabata architecture</h3>
      <p className="text-sm text-white/65">
        Classic Tabata uses <span className="text-white/85">20 seconds work / 10 seconds rest</span>{' '}
        per interval. The widely used default is{' '}
        <span className="text-white/85">8 rounds</span> (about four minutes of main work); you can
        adjust rounds for fit clients or regressions. This mode is separate from generic HIIT →
        &quot;Tabata Style&quot; — it applies guided strength/cardio pairing presets.
      </p>
      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">Pairing pattern</label>
        <select
          value={pairingPattern}
          onChange={(e) => onPairingPatternChange(e.target.value as TabataBalancedPairingPattern)}
          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
        >
          {PAIRING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-white/55">{PAIRING_OPTIONS.find((t) => t.value === pairingPattern)?.detail}</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Total work intervals (rounds)
        </label>
        <input
          type="number"
          min={TABATA_BALANCED_MIN_ROUNDS}
          max={TABATA_BALANCED_MAX_ROUNDS}
          step={1}
          value={roundCount}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v)) return;
            onRoundCountChange(Math.min(TABATA_BALANCED_MAX_ROUNDS, Math.max(TABATA_BALANCED_MIN_ROUNDS, v)));
          }}
          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full max-w-[120px] rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
        />
        <p className="mt-2 text-xs text-white/55">
          Session clock for the main block: ~{sessionMin} min (ceil of {roundCount} × 30s).{' '}
          {nEx > 1 ? (
            <>
              For this pattern, rounds must be divisible by {nEx} so each exercise gets the same
              number of work intervals.
              {!roundsValid ? (
                <span className="text-amber-300"> Adjust rounds or change pairing.</span>
              ) : null}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
};

export default TabataBalancedArchitecture;
