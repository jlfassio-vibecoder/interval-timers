/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quick Stats Bar for Zone 3: time streak, workouts this month, day streak, week-to-date minutes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  computeTimeStreakWeeks,
  computeTrainingLogQuickStats,
} from '@/lib/training-log-quick-stats';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { getMinutesThisWeek } from '@/lib/training-log-utils';
import { getProgressTextColorClassForValue } from '@/lib/progress-color-ramp';
import { getTrainingLogLocalTodayISO } from '@/lib/supabase/client/training-log';

export interface QuickStatsBarProps {
  userId: string;
  activeProgramId: string | null;
}

const QuickStatsBar: React.FC<QuickStatsBarProps> = ({
  userId: _userId,
  activeProgramId: _activeProgramId,
}) => {
  const { workoutLogs, user } = useAppContext();
  const [todayISO, setTodayISO] = useState(() => getTrainingLogLocalTodayISO());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextLocalMidnightTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setDate(now.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 50); // small buffer after midnight boundary
      const delayMs = Math.max(1000, nextMidnight.getTime() - now.getTime());

      timeoutId = setTimeout(() => {
        setTodayISO(getTrainingLogLocalTodayISO());
        scheduleNextLocalMidnightTick();
      }, delayMs);
    };

    scheduleNextLocalMidnightTick();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const quickStats = useMemo(
    () => computeTrainingLogQuickStats(workoutLogs, todayISO),
    [workoutLogs, todayISO]
  );
  const weeklyTargetMinutes = Math.max(
    1,
    user?.weeklyGoalMinutes ?? HEALTH_GUIDELINE_WEEKLY_MINUTES
  );
  const weekToDateMinutes = useMemo(
    () => Math.round(getMinutesThisWeek(workoutLogs)),
    [workoutLogs, todayISO]
  );
  const weekToDateColorClass = useMemo(
    () => getProgressTextColorClassForValue(weekToDateMinutes, weeklyTargetMinutes),
    [weekToDateMinutes, weeklyTargetMinutes]
  );
  const timeStreak = useMemo(
    () => computeTimeStreakWeeks(workoutLogs, weeklyTargetMinutes, todayISO),
    [workoutLogs, weeklyTargetMinutes, todayISO]
  );

  return (
    <div className="flex flex-wrap gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">Time streak</span>
        <p className="font-heading text-lg font-bold text-white">{timeStreak}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">This month</span>
        <p className="font-heading text-lg font-bold text-white">{quickStats.sessionsThisMonth}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">Day streak</span>
        <p className="font-heading text-lg font-bold text-white">{quickStats.dayStreak}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="font-mono text-[10px] uppercase text-white/50">Week to date</span>
        <p className={`font-heading text-lg font-bold ${weekToDateColorClass}`}>
          {weekToDateMinutes}/{weeklyTargetMinutes} min
        </p>
      </div>
    </div>
  );
};

export default QuickStatsBar;
