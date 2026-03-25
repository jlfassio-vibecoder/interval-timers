/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Activity bubble for Training Log week grid. Shows duration; supports multi-workout hover split.
 */

import React, { useMemo, useCallback } from 'react';
import {
  getBubbleColor,
  getCircleSize,
  getTextSize,
  splitWorkoutTime,
} from '@/lib/training-log-display';
import type { GoalAlignmentTier } from '@/lib/fitness-goal-alignment';
import type { WorkoutLog } from '@/types';

const LIGHT_COLOR_MAP: Record<string, string> = {
  'bg-slate-500/50': 'bg-slate-400',
  'bg-gray-600': 'bg-gray-400',
  'bg-green-600': 'bg-green-400',
  'bg-orange-500': 'bg-orange-300',
  'bg-red-500': 'bg-red-300',
  'bg-red-700': 'bg-red-400',
};

const LIGHTER_COLOR_MAP: Record<string, string> = {
  'bg-slate-500/50': 'bg-slate-300',
  'bg-gray-600': 'bg-gray-200',
  'bg-green-600': 'bg-green-200',
  'bg-orange-500': 'bg-orange-200',
  'bg-red-500': 'bg-red-200',
  'bg-red-700': 'bg-red-200',
};

function getRingSize(sizeClass: string, extra: number): string {
  const m = sizeClass.match(/w-(\d+)/);
  const n = m ? parseInt(m[1], 10) : 6;
  const px = n * 4 + extra;
  return `${px}px`;
}

export interface ActivityDotProps {
  count: number;
  minutes: number;
  isEmpty: boolean;
  dayIndex: number;
  weekIndex: number;
  dayLabel: string;
  logs: WorkoutLog[];
  onClick?: (logs: WorkoutLog[], preferredMinutes?: number) => void;
  onHoverChange?: (key: string | null) => void;
  hoveredKey: string | null;
  /** Calendar date YYYY-MM-DD (for today/future planned outline). */
  dateISO: string;
  todayISO: string;
  /** Planned minutes from calendar (scheduled); shown as outline when no completed minutes. */
  plannedMinutes?: number;
  /** Precomputed per-day alignment tier from parent row (do not compute in dot). */
  alignmentTier?: GoalAlignmentTier | null;
}

const ActivityDotInner: React.FC<ActivityDotProps> = ({
  count,
  minutes,
  isEmpty,
  dayIndex,
  weekIndex,
  dayLabel,
  logs,
  onClick,
  onHoverChange,
  hoveredKey,
  dateISO,
  todayISO,
  plannedMinutes = 0,
  alignmentTier = null,
}) => {
  const uniqueKey = `${weekIndex}-${dayIndex}`;
  const isHovered = hoveredKey === uniqueKey;

  const workoutTimes = useMemo(
    () => (count > 1 ? splitWorkoutTime(minutes, count) : [minutes]),
    [minutes, count]
  );

  const handleClick = useCallback(
    (preferredMinutes?: number) => {
      if (onClick && logs.length > 0) onClick(logs, preferredMinutes);
    },
    [onClick, logs]
  );

  /** Planned-only: today or future, no completed volume for that day. */
  const showPlannedOutline = minutes === 0 && plannedMinutes > 0 && dateISO >= todayISO;

  const alignmentTierLabel =
    alignmentTier === 'high'
      ? 'high'
      : alignmentTier === 'mid'
        ? 'moderate'
        : alignmentTier === 'low'
          ? 'low'
          : null;
  const ariaLabel =
    isEmpty || (minutes === 0 && !showPlannedOutline)
      ? undefined
      : showPlannedOutline
        ? `Planned ${plannedMinutes} minutes on ${dayLabel}`
        : `View ${minutes} minute workout${count > 1 ? 's' : ''} on ${dayLabel}${
            alignmentTierLabel ? `. Goal alignment: ${alignmentTierLabel}` : ''
          }`;

  if (isEmpty && !showPlannedOutline) {
    return (
      <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <div className="h-2 w-2 rounded-full bg-white/20" />
        </div>
      </div>
    );
  }

  if (showPlannedOutline) {
    const circleSize = getCircleSize(plannedMinutes);
    const textSize = getTextSize(plannedMinutes);
    return (
      <div
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className={`relative ${circleSize} flex items-center justify-center rounded-full border-2 border-dashed border-white/50 bg-transparent ${textSize} font-bold text-white/80`}
        >
          {plannedMinutes}
        </div>
      </div>
    );
  }

  const color = getBubbleColor(minutes);
  const circleSize = getCircleSize(minutes);
  const textSize = getTextSize(minutes);
  const lightColor = LIGHT_COLOR_MAP[color] ?? color;
  const lighterColor = LIGHTER_COLOR_MAP[color] ?? color;

  if (count > 1 && isHovered) {
    return (
      <div
        className="flex items-center justify-center gap-1"
        onMouseLeave={() => onHoverChange?.(null)}
      >
        {workoutTimes.map((time, index) => {
          const splitSize = getCircleSize(time);
          const splitTextSize = getTextSize(time);
          const splitColor = getBubbleColor(time);
          const splitLight = LIGHT_COLOR_MAP[splitColor] ?? splitColor;
          const splitLighter = LIGHTER_COLOR_MAP[splitColor] ?? splitColor;
          return (
            <div key={index} className="relative flex items-center justify-center">
              <div
                className={`absolute rounded-full ${splitLighter} animate-pulse opacity-30`}
                style={{
                  width: getRingSize(splitSize, 12),
                  height: getRingSize(splitSize, 12),
                }}
              />
              <div
                className={`absolute rounded-full ${splitLight} animate-pulse opacity-50`}
                style={{
                  width: getRingSize(splitSize, 6),
                  height: getRingSize(splitSize, 6),
                  animationDelay: '0.2s',
                }}
              />
              <div
                className={`relative ${splitSize} flex items-center justify-center rounded-full text-white ${splitTextSize} font-bold ${splitColor} z-10 cursor-pointer border border-white/10 transition-transform hover:scale-110`}
                onClick={() => handleClick(time)}
              >
                {time}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role={minutes > 0 ? 'button' : undefined}
      tabIndex={minutes > 0 ? 0 : undefined}
      aria-label={ariaLabel}
      className="relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center"
      onMouseEnter={() => (count > 1 ? onHoverChange?.(uniqueKey) : null)}
      onClick={() => handleClick()}
      onKeyDown={(e) => {
        if (minutes > 0 && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div
        className={`absolute rounded-full ${lighterColor} animate-pulse opacity-30`}
        style={{
          width: getRingSize(circleSize, 16),
          height: getRingSize(circleSize, 16),
        }}
      />
      <div
        className={`absolute rounded-full ${lightColor} animate-pulse opacity-50`}
        style={{
          width: getRingSize(circleSize, 8),
          height: getRingSize(circleSize, 8),
          animationDelay: '0.2s',
        }}
      />
      <div
        className={`relative ${circleSize} flex items-center justify-center rounded-full text-white ${textSize} font-bold ${color} z-10 border border-white/10 transition-transform hover:scale-110`}
      >
        {minutes > 0 && minutes}
        {count > 1 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            {count}
          </span>
        )}
        {alignmentTier && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-black/50 ${
              alignmentTier === 'high'
                ? 'bg-emerald-300'
                : alignmentTier === 'mid'
                  ? 'bg-amber-300'
                  : 'bg-rose-300'
            }`}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
};

const ActivityDot = React.memo(ActivityDotInner);
export default ActivityDot;
