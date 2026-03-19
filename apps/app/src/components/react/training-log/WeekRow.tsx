/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single week row for Training Log: range label + 7 ActivityDots (Mon–Sun).
 */

import React, { forwardRef, useCallback } from 'react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import ActivityDot from './ActivityDot';
import type { TrainingLogWeek } from '@/lib/supabase/client/training-log';
import type { WorkoutLog } from '@/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Weekly total color: red <100, orange 100-149, green 150+ (health guideline) */
function getWeekTotalColor(totalMinutes: number): string {
  if (totalMinutes < 100) return 'bg-red-500/80 text-white';
  if (totalMinutes < HEALTH_GUIDELINE_WEEKLY_MINUTES) return 'bg-orange-500/80 text-white';
  return 'bg-green-600/80 text-white';
}

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
  const totalColor = getWeekTotalColor(week.totalMinutes);
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
            className={`${hideRangeLabel ? '' : 'mt-0.5 '}rounded px-1.5 py-0.5 font-mono text-sm font-bold ${totalColor}`}
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
                  className={`h-full shrink-0 ${totalColor.split(' ')[0]}`}
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
              <p className="text-orange-400/90 mt-1 font-mono text-[9px]">
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
