/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main content for HUDShell: Today Zone, Recent Progress, Calendar, History.
 */

import React, { useCallback } from 'react';
import TodayZone from './TodayZone';
import ProgressZone from './ProgressZone';
import ScheduleZone from './ScheduleZone';
import HistoryZone from './HistoryZone';
import type { WorkoutLog } from '@/types';

export interface HUDContentProps {
  isPaid: boolean;
  /** When false, hide upgrade CTAs (e.g. user has only trainer_assigned/cohort programs). */
  showUpgradePrompts: boolean;
  onOpenConversionModal: () => void;
  /** For ghost state message, e.g. "5 Workouts Completed this week." */
  workoutsThisWeek?: number;
  workoutLogs?: WorkoutLog[];
  /** When changed, calendar refetches (e.g. after Sync to Calendar). */
  calendarRefreshKey?: number;
}

const HUDContent: React.FC<HUDContentProps> = ({
  isPaid,
  showUpgradePrompts,
  onOpenConversionModal,
  workoutsThisWeek = 5,
  workoutLogs: _workoutLogs = [],
  calendarRefreshKey = 0,
}) => {
  const scrollToHistory = useCallback(() => {
    document.getElementById('history-zone')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <TodayZone
        isPaid={isPaid}
        showUpgradePrompts={showUpgradePrompts}
        onOpenConversionModal={onOpenConversionModal}
      />

      <ProgressZone
        isPaid={isPaid}
        showUpgradePrompts={showUpgradePrompts}
        onOpenConversionModal={onOpenConversionModal}
        workoutsThisWeek={workoutsThisWeek}
      />

      <ScheduleZone refreshKey={calendarRefreshKey} onViewLog={scrollToHistory} />

      <div id="history-zone">
        <HistoryZone />
      </div>
    </div>
  );
};

export default HUDContent;
