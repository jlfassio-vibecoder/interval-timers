/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook to fetch Training Log analytics for the dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import {
  getTrainingLogAnalytics,
  type TrainingLogAnalytics,
} from '@/lib/supabase/client/training-log';
import type { TrainingLogFilters } from '@/lib/training-log-filters';

export interface UseTrainingLogAnalyticsResult {
  data: TrainingLogAnalytics | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch analytics for the Training Log dashboard.
 * Refetches when uid, weeksBack, filters, or goalMinutes change.
 */
export function useTrainingLogAnalytics(
  uid: string | null,
  weeksBack = 24,
  filters?: TrainingLogFilters,
  goalMinutes = HEALTH_GUIDELINE_WEEKLY_MINUTES
): UseTrainingLogAnalyticsResult {
  const [data, setData] = useState<TrainingLogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!uid) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getTrainingLogAnalytics(uid, weeksBack, filters, goalMinutes);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    uid,
    weeksBack,
    goalMinutes,
    filters?.workoutType,
    filters?.workoutFormat,
    filters?.durationRange,
    filters?.excludeActiveRest,
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}
