/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook to fetch and aggregate Training Log weeks with optional filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { getTrainingLogWeeks } from '@/lib/supabase/client/training-log';
import type { TrainingLogWeek } from '@/lib/supabase/client/training-log';
import type { WorkoutLog } from '@/types';
import type { TrainingLogFilters } from '@/lib/training-log-filters';

export interface UseTrainingLogWeeksResult {
  weeks: TrainingLogWeek[];
  logsByDate: Record<string, WorkoutLog[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch aggregated training log weeks for the given user.
 * Refetches when uid, weeksBack, weeksForward, or filters change.
 */
export function useTrainingLogWeeks(
  uid: string | null,
  weeksBack = 52,
  filters?: TrainingLogFilters,
  weeksForward = 12
): UseTrainingLogWeeksResult {
  const [weeks, setWeeks] = useState<TrainingLogWeek[]>([]);
  const [logsByDate, setLogsByDate] = useState<Record<string, WorkoutLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWeeks = useCallback(async () => {
    if (!uid) {
      setWeeks([]);
      setLogsByDate({});
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getTrainingLogWeeks(uid, weeksBack, filters, weeksForward);
      setWeeks(result.weeks);
      setLogsByDate(result.logsByDate);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setWeeks([]);
      setLogsByDate({});
    } finally {
      setLoading(false);
    }
  }, [
    uid,
    weeksBack,
    weeksForward,
    filters?.workoutType,
    filters?.workoutFormat,
    filters?.durationRange,
    filters?.excludeActiveRest,
  ]);

  useEffect(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  return { weeks, logsByDate, loading, error, refetch: fetchWeeks };
}
