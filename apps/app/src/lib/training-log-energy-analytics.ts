/**
 * Estimated calorie aggregates for Training Log analytics (filter-aware logs + MET baseline).
 * Week/month boundaries match getTrainingLogAnalytics in supabase/client/training-log.
 */

import type { WorkoutLog } from '@/types';
import type { ProfileBaseline } from '@/lib/met';
import { estimateSessionKcalFromLog, hasBaselineForMET } from '@/lib/met';
import {
  getTrainingLogWeekMonday,
  getTrainingLogLocalTodayISO,
} from '@/lib/supabase/client/training-log';

export interface TrainingLogEnergyAggregates {
  weekEstimatedKcal: number;
  monthEstimatedKcal: number;
  /** All sessions in the current calendar month (same semantics as minutes analytics). */
  monthSessionCount: number;
  /** Sessions in that month with a non-null per-session estimate (has duration, etc.). */
  monthSessionsWithEstimate: number;
  /** Average estimated kcal for sessions that had an estimate; null if none. */
  monthAvgEstimatedKcal: number | null;
}

export function computeTrainingLogEnergyAggregates(
  logs: WorkoutLog[],
  baseline: ProfileBaseline | null
): TrainingLogEnergyAggregates | null {
  if (baseline == null || !hasBaselineForMET(baseline)) return null;

  const today = getTrainingLogLocalTodayISO();
  const thisWeekMon = getTrainingLogWeekMonday(today);
  const [thisYear, thisMonth] = today.split('-');
  const thisMonthStart = `${thisYear}-${thisMonth}-01`;

  let weekEstimatedKcal = 0;
  let monthEstimatedKcal = 0;
  let monthSessionCount = 0;
  let monthSessionsWithEstimate = 0;

  for (const log of logs) {
    const weekMon = getTrainingLogWeekMonday(log.date);
    const inMonth = log.date >= thisMonthStart;

    if (inMonth) {
      monthSessionCount += 1;
    }

    const kcal = estimateSessionKcalFromLog(log, baseline);
    if (kcal == null) {
      continue;
    }

    if (weekMon === thisWeekMon) {
      weekEstimatedKcal += kcal;
    }
    if (inMonth) {
      monthEstimatedKcal += kcal;
      monthSessionsWithEstimate += 1;
    }
  }

  const monthAvgEstimatedKcal =
    monthSessionsWithEstimate > 0
      ? Math.round(monthEstimatedKcal / monthSessionsWithEstimate)
      : null;

  return {
    weekEstimatedKcal,
    monthEstimatedKcal,
    monthSessionCount,
    monthSessionsWithEstimate,
    monthAvgEstimatedKcal,
  };
}
