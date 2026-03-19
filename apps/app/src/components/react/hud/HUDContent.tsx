/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main content for HUDShell: Today Zone, Recent Progress, Calendar, History.
 */

import React, { useCallback, useState } from 'react';
import TodayZone from './TodayZone';
import ProgressZone from './ProgressZone';
import ScheduleZone from './ScheduleZone';
import HistoryZone from './HistoryZone';
import AmrapProgressSection from './AmrapProgressSection';
import type { UpcomingStripDay } from './UpcomingStrip';
import type { WorkoutLog } from '@/types';
import type { CalendarEvent } from '@/lib/calendar-events';

export interface StripDataForUpcoming {
  stripDays: UpcomingStripDay[];
  todayISO: string;
  restDays: Set<string>;
  onDayClick: (date: string, events: CalendarEvent[]) => void;
}

export interface HUDContentProps {
  isPaid: boolean;
  /** When false, hide upgrade CTAs (e.g. user has only trainer_assigned/cohort programs). */
  showUpgradePrompts: boolean;
  onOpenConversionModal: () => void;
  /** For ghost state message, e.g. "5 Workouts Completed this week." */
  workoutsThisWeek?: number;
  workoutLogs?: WorkoutLog[];
  /** Called when calendar should refetch (e.g. AMRAP scheduled, workout completed). */
  onCalendarRefresh?: () => void;
  /** When changed, calendar refetches (e.g. after Sync to Calendar). */
  calendarRefreshKey?: number;
  /** When changed, history zone refetches (e.g. realtime workout logs / AMRAP results). */
  historyRefreshKey?: number;
}

const HUDContent: React.FC<HUDContentProps> = ({
  isPaid,
  showUpgradePrompts,
  onOpenConversionModal,
  workoutsThisWeek = 5,
  workoutLogs = [],
  onCalendarRefresh,
  calendarRefreshKey = 0,
  historyRefreshKey = 0,
}) => {
  const [stripData, setStripData] = useState<StripDataForUpcoming | null>(null);
  const scrollToHistory = useCallback(() => {
    document.getElementById('history-zone')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <TodayZone
        isPaid={isPaid}
        showUpgradePrompts={showUpgradePrompts}
        onOpenConversionModal={onOpenConversionModal}
        stripData={stripData}
      />

      <ProgressZone
        isPaid={isPaid}
        showUpgradePrompts={showUpgradePrompts}
        onOpenConversionModal={onOpenConversionModal}
        workoutsThisWeek={workoutsThisWeek}
      />

      <ScheduleZone
        refreshKey={calendarRefreshKey}
        onViewLog={scrollToHistory}
        onCalendarRefresh={onCalendarRefresh}
        workoutsThisWeek={workoutsThisWeek}
        workoutLogs={workoutLogs}
        onStripDataReady={setStripData}
      />

      <div id="history-zone">
        <HistoryZone refreshKey={historyRefreshKey} onCalendarRefresh={onCalendarRefresh} />
      </div>

      <AmrapProgressSection />
    </div>
  );
};

export default HUDContent;
