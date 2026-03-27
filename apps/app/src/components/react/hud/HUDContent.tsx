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
import { TrainingLogPreview } from '@/components/react/training-log';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { getMinutesThisWeek } from '@/lib/training-log-utils';
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
  hasProgressAnalyticsAccess: boolean;
  /** When false, hide upgrade CTAs (e.g. user has only trainer_assigned/cohort programs). */
  showUpgradePrompts: boolean;
  onOpenConversionModal: () => void;
  /** For ghost state message, e.g. "5 Workouts Completed this week." */
  workoutsThisWeek?: number;
  workoutLogs?: WorkoutLog[];
  /** Training Log weekly goal (minutes). Default 150. */
  goalMinutes?: number;
  /** Called when calendar should refetch (e.g. AMRAP scheduled, workout completed). */
  onCalendarRefresh?: () => void;
  /** When changed, calendar refetches (e.g. after Sync to Calendar). */
  calendarRefreshKey?: number;
  /** When changed, history zone refetches (e.g. realtime workout logs / AMRAP results). */
  historyRefreshKey?: number;
}

const HUDContent: React.FC<HUDContentProps> = ({
  isPaid,
  hasProgressAnalyticsAccess,
  showUpgradePrompts,
  onOpenConversionModal,
  workoutsThisWeek = 5,
  workoutLogs = [],
  goalMinutes = HEALTH_GUIDELINE_WEEKLY_MINUTES,
  onCalendarRefresh,
  calendarRefreshKey = 0,
  historyRefreshKey = 0,
}) => {
  const [stripData, setStripData] = useState<StripDataForUpcoming | null>(null);
  const minutesThisWeek = getMinutesThisWeek(workoutLogs ?? []);
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
        hasAccess={hasProgressAnalyticsAccess}
        showUpgradePrompts={showUpgradePrompts}
        onOpenConversionModal={onOpenConversionModal}
        workoutsThisWeek={workoutsThisWeek}
      />

      <TrainingLogPreview minutesThisWeek={minutesThisWeek} goalMinutes={goalMinutes} />

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
