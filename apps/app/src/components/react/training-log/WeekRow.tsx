/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single week row for Training Log: range label + 7 ActivityDots (Mon–Sun).
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import {
  getProgressBgColorClassForValue,
  getProgressSoftBgColorClassForValue,
  getProgressTextColorClassForValue,
} from '@/lib/progress-color-ramp';
import {
  alignmentCompositeForLog,
  alignmentTierFromComposite,
  type GoalAlignmentTier,
} from '@/lib/fitness-goal-alignment';
import ActivityDot from './ActivityDot';
import type { TrainingLogWeek } from '@/lib/supabase/client/training-log';
import type { WorkoutLog } from '@/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface WeekRowProps {
  week: TrainingLogWeek;
  weekIndex: number;
  goalMinutes?: number;
  /** Local calendar today YYYY-MM-DD (passed to ActivityDot for planned outline). */
  todayISO: string;
  onWorkoutClick?: (logs: WorkoutLog[], preferredMinutes?: number) => void;
  hoveredKey: string | null;
  onHoverChange?: (key: string | null) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  /** When true, omit row bottom border (e.g. horizontal week card). */
  inCard?: boolean;
  /** When true, hide the date range line (shown on parent card header). */
  hideRangeLabel?: boolean;
}

const WeekRowInner = forwardRef<HTMLDivElement, WeekRowProps>(function WeekRowInner(
  {
    week,
    weekIndex,
    goalMinutes = HEALTH_GUIDELINE_WEEKLY_MINUTES,
    todayISO,
    onWorkoutClick,
    hoveredKey,
    onHoverChange,
    isFocused = false,
    onFocus,
    inCard = false,
    hideRangeLabel = false,
  },
  ref
) {
  const showPlannedWeekTotal = week.plannedWeekMinutes > 0;
  const G = Math.max(1, goalMinutes);
  const H = HEALTH_GUIDELINE_WEEKLY_MINUTES;
  const completed = week.totalMinutes;
  const planned = week.plannedWeekMinutes;
  const showGhost = G < H;
  // Bar scale: 100% = target (G). Three segments: completed, planned, unplanned (remaining to target).
  const completedPct = Math.min(100, (completed / G) * 100);
  const plannedPct = Math.min(100 - completedPct, (planned / G) * 100);
  const unplannedPct = Math.max(0, 100 - completedPct - plannedPct);
  const ghostPct = showGhost ? (H / G) * 100 : 0;
  const remainingMinutes = Math.max(0, G - completed - planned);
  const completedBarColorClass = getProgressBgColorClassForValue(completed, G);
  const progressTextClass = getProgressTextColorClassForValue(completed, G);
  const totalBadgeClass = `${getProgressSoftBgColorClassForValue(completed, G)} text-white`;

  const firstDayWithLogs = week.days.find((d) => d.logs.length > 0);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && firstDayWithLogs && onWorkoutClick) {
        e.preventDefault();
        onWorkoutClick(firstDayWithLogs.logs);
      }
    },
    [firstDayWithLogs, onWorkoutClick]
  );

  const alignmentTiersByDay = useMemo<(GoalAlignmentTier | null)[]>(
    () =>
      week.days.map((day) => {
        if (day.minutes <= 0 || day.logs.length === 0) return null;
        let sum = 0;
        let count = 0;
        for (const log of day.logs) {
          const composite = alignmentCompositeForLog(log);
          if (composite == null) continue;
          sum += composite;
          count += 1;
        }
        if (count === 0) return null;
        return alignmentTierFromComposite(Math.round(sum / count));
      }),
    [week.days]
  );

  return (
    <div
      ref={ref}
      role="row"
      tabIndex={0}
      aria-label={`Week of ${week.range}, ${week.totalMinutes} minutes total`}
      className={`flex items-center gap-2 py-3 ${
        inCard ? '' : 'border-b border-white/5 last:border-b-0'
      } ${isFocused ? 'ring-orange-light/50 rounded-md ring-1 ring-inset' : ''}`}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
    >
      {!inCard && (
        <div className="flex w-24 shrink-0 flex-col items-end pr-2">
          {!hideRangeLabel && <span className="font-mono text-xs text-white/70">{week.range}</span>}
          <span
            className={`${hideRangeLabel ? '' : 'mt-0.5 '}rounded px-1.5 py-0.5 font-mono text-sm font-bold ${totalBadgeClass}`}
          >
            {week.totalMinutes} min
          </span>
          {showPlannedWeekTotal && (
            <span
              className="mt-0.5 font-mono text-[10px] text-white/45"
              title="Planned (scheduled)"
            >
              +{week.plannedWeekMinutes} planned
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2">
        {inCard && (
          <div className="px-2 sm:px-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span className="text-white/85">{week.totalMinutes} min completed</span>
              <span className="text-white/55">
                {week.plannedWeekMinutes > 0
                  ? `+${week.plannedWeekMinutes} planned`
                  : 'No planned minutes'}
              </span>
            </div>
            {showGhost && (
              <p className="mb-1 font-mono text-[9px] text-white/35">
                Target: {G} min · Guideline: {H} min
              </p>
            )}
            <div
              className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10"
              aria-label={`Week progress: ${week.totalMinutes} completed, ${week.plannedWeekMinutes} planned, ${remainingMinutes} min remaining to goal of ${G}${showGhost ? `. Health guideline: ${H} minutes per week shown as dashed line` : ''}`}
            >
              <div className="flex h-full w-full">
                <div
                  className={`h-full shrink-0 ${completedBarColorClass}`}
                  style={{ width: `${completedPct}%` }}
                />
                <div className="h-full shrink-0 bg-white/30" style={{ width: `${plannedPct}%` }} />
                {unplannedPct > 0 && (
                  <div
                    className="h-full shrink-0 bg-black/30"
                    style={{ width: `${unplannedPct}%` }}
                    title={`${remainingMinutes} min remaining to reach ${G} min goal`}
                  />
                )}
              </div>
              {showGhost && ghostPct > 0 && ghostPct < 100 && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-0 border-l border-dashed border-white/25"
                  style={{ left: `${ghostPct}%` }}
                  title={`${H} min weekly guideline (WHO-style moderate activity)`}
                  aria-hidden
                />
              )}
            </div>
            {remainingMinutes > 0 && (
              <p className={`mt-1 font-mono text-[9px] ${progressTextClass}`}>
                {remainingMinutes} min needed to reach {G} min goal
              </p>
            )}
          </div>
        )}
        <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-2 md:gap-3">
          {week.days.map((day, dayIndex) => (
            <div key={dayIndex} className="flex justify-center">
              <ActivityDot
                count={day.count}
                minutes={day.minutes}
                isEmpty={day.isEmpty}
                dayIndex={dayIndex}
                weekIndex={weekIndex}
                dayLabel={DAY_NAMES[dayIndex]}
                logs={day.logs}
                onClick={onWorkoutClick}
                onHoverChange={onHoverChange}
                hoveredKey={hoveredKey}
                dateISO={day.dateISO}
                todayISO={todayISO}
                plannedMinutes={day.plannedMinutes}
                alignmentTier={alignmentTiersByDay[dayIndex] ?? null}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const WeekRow = React.memo(WeekRowInner);
export default WeekRow;
export { DAY_LABELS };
