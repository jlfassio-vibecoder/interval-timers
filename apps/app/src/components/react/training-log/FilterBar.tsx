/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Filter bar for Training Log: Type, Format, Duration, Exclude Active Rest.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { WORKOUT_TYPES, WORKOUT_FORMATS, DURATION_FILTERS } from '@/lib/training-log-filters';
import type { TrainingLogFilters } from '@/lib/training-log-filters';

export interface FilterBarProps {
  filters: TrainingLogFilters;
  onFiltersChange: (filters: TrainingLogFilters) => void;
}

const DROPDOWN_BASE =
  'absolute top-full left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/90 backdrop-blur-sm';

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFiltersChange }) => {
  const [showType, setShowType] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowType(false);
        setShowFormat(false);
        setShowDuration(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const workoutType = filters.workoutType ?? 'All';
  const workoutFormat = filters.workoutFormat ?? 'All';
  const durationRange = filters.durationRange ?? 'All';
  const excludeActiveRest = filters.excludeActiveRest ?? false;

  const btnBase =
    'flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm transition-colors';
  const btnInactive = 'border-white/10 bg-white/5 text-white/90 hover:bg-white/10';
  const btnActive = 'border-orange-light/50 bg-orange-light/10 text-orange-light';

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-3"
    >
      {/* Workout Type */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowType(!showType);
            setShowFormat(false);
            setShowDuration(false);
          }}
          className={`${btnBase} ${workoutType !== 'All' ? btnActive : btnInactive}`}
          aria-label="Filter by workout type"
          aria-expanded={showType}
          aria-haspopup="listbox"
        >
          <span>{workoutType === 'All' ? 'Type' : workoutType}</span>
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        {showType && (
          <div className={`${DROPDOWN_BASE} w-56`} role="listbox">
            {WORKOUT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={workoutType === type}
                onClick={() => {
                  onFiltersChange({ ...filters, workoutType: type });
                  setShowType(false);
                }}
                className={`flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${
                  workoutType === type
                    ? 'bg-white/10 font-medium text-orange-light'
                    : 'text-white/90'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Format */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowFormat(!showFormat);
            setShowType(false);
            setShowDuration(false);
          }}
          className={`${btnBase} ${workoutFormat !== 'All' ? btnActive : btnInactive}`}
          aria-label="Filter by workout format"
          aria-expanded={showFormat}
          aria-haspopup="listbox"
        >
          <span>{workoutFormat === 'All' ? 'Format' : workoutFormat}</span>
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        {showFormat && (
          <div className={`${DROPDOWN_BASE} w-48`} role="listbox">
            {WORKOUT_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                role="option"
                aria-selected={workoutFormat === format}
                onClick={() => {
                  onFiltersChange({ ...filters, workoutFormat: format });
                  setShowFormat(false);
                }}
                className={`flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${
                  workoutFormat === format
                    ? 'bg-white/10 font-medium text-orange-light'
                    : 'text-white/90'
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowDuration(!showDuration);
            setShowType(false);
            setShowFormat(false);
          }}
          className={`${btnBase} ${durationRange !== 'All' ? btnActive : btnInactive}`}
          aria-label="Filter by duration"
          aria-expanded={showDuration}
          aria-haspopup="listbox"
        >
          <span>{durationRange === 'All' ? 'Duration' : durationRange}</span>
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        {showDuration && (
          <div className={`${DROPDOWN_BASE} w-32`} role="listbox">
            {DURATION_FILTERS.map((duration) => (
              <button
                key={duration}
                type="button"
                role="option"
                aria-selected={durationRange === duration}
                onClick={() => {
                  onFiltersChange({ ...filters, durationRange: duration });
                  setShowDuration(false);
                }}
                className={`flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${
                  durationRange === duration
                    ? 'bg-white/10 font-medium text-orange-light'
                    : 'text-white/90'
                }`}
              >
                {duration}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Exclude Active Rest */}
      <button
        type="button"
        onClick={() => onFiltersChange({ ...filters, excludeActiveRest: !excludeActiveRest })}
        className={`${btnBase} ${excludeActiveRest ? btnActive : btnInactive}`}
        aria-label="Exclude active rest workouts"
      >
        Exclude Active Rest
      </button>
    </div>
  );
};

export default FilterBar;
