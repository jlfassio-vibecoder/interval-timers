/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics dashboard: summary cards, volume chart, distribution charts, insights.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { useTrainingLogAnalytics } from '@/hooks/useTrainingLogAnalytics';
import { getTrainingLogLogsForExport } from '@/lib/supabase/client/training-log';
import { generateInsights } from '@/lib/training-log-insights';
import type { TrainingLogFilters } from '@/lib/training-log-filters';
import AnalyticsSummaryCards from './AnalyticsSummaryCards';
import WeeklyVolumeChart from './WeeklyVolumeChart';
import DistributionCharts from './DistributionCharts';
import InsightsPanel from './InsightsPanel';

export interface TrainingLogAnalyticsProps {
  uid: string;
  filters?: TrainingLogFilters;
  goalMinutes?: number;
}

const TrainingLogAnalytics: React.FC<TrainingLogAnalyticsProps> = ({
  uid,
  filters,
  goalMinutes = HEALTH_GUIDELINE_WEEKLY_MINUTES,
}) => {
  const { setWeeklyGoalMinutes } = useAppContext();
  const { data, loading, error } = useTrainingLogAnalytics(uid, 24, filters, goalMinutes);

  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getTrainingLogLogsForExport>>>([]);

  const fetchLogs = useCallback(async () => {
    if (!uid) return;
    const result = await getTrainingLogLogsForExport(uid, filters);
    setLogs(result);
  }, [
    uid,
    filters?.workoutType,
    filters?.workoutFormat,
    filters?.durationRange,
    filters?.excludeActiveRest,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const insights = data && logs.length >= 0 ? generateInsights(data, logs, goalMinutes) : [];

  if (error) {
    return (
      <p className="rounded-xl bg-red-500/10 py-8 text-center font-mono text-sm text-red-400">
        Failed to load analytics: {error.message}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white/5 font-mono text-[10px] uppercase text-white/40">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsSummaryCards
        thisWeek={data.thisWeek}
        thisMonth={data.thisMonth}
        streak={data.streak}
        mostActiveDay={data.mostActiveDay}
        goalMinutes={goalMinutes}
        onEditGoal={setWeeklyGoalMinutes}
      />
      <div id="weekly-volume-chart" className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          Weekly Volume Trend
        </h4>
        <WeeklyVolumeChart data={data.weeklyVolume} loading={loading} />
      </div>
      <InsightsPanel insights={insights} />
      <DistributionCharts
        byType={data.byType}
        byFormat={data.byFormat}
        byDayOfWeek={data.byDayOfWeek}
      />
    </div>
  );
};

export default TrainingLogAnalytics;
