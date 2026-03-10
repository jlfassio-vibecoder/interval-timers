/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared level filter for index pages: All, Beginner, Intermediate, Advanced.
 * Presentation only; parent owns state and filtering logic.
 */

import React from 'react';

export type LevelFilterValue = 'all' | 'beginner' | 'intermediate' | 'advanced';

const LEVEL_OPTIONS: { value: LevelFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export interface LevelFilterProps {
  selectedLevel: LevelFilterValue;
  onLevelChange: (level: LevelFilterValue) => void;
  /** Optional label above the pills (e.g. "Level"). */
  label?: string;
  /** When true, only Beginner / Intermediate / Advanced are shown (for WOD Engine level selector). */
  variant?: 'default' | 'wod';
}

const LevelFilter: React.FC<LevelFilterProps> = ({
  selectedLevel,
  onLevelChange,
  label = 'Level',
  variant = 'default',
}) => {
  const options =
    variant === 'wod' ? LEVEL_OPTIONS.filter((opt) => opt.value !== 'all') : LEVEL_OPTIONS;
  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onLevelChange(opt.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedLevel === opt.value
                ? 'border-orange-light/50 bg-orange-light/20 text-orange-light'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LevelFilter;
