/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rule-based insights engine for Training Log.
 */

import type { TrainingLogAnalytics } from '@/lib/supabase/client/training-log';
import type { WorkoutLog } from '@/types';
import { deriveWorkoutType } from '@/lib/supabase/client/training-log';

export interface TrainingLogInsight {
  id: string;
  text: string;
  category: 'volume' | 'balance' | 'recency' | 'consistency';
  link?: { label: string; scrollTo?: string };
}

/** Get Monday (YYYY-MM-DD) of the week containing the given date. */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

/** Check if focus_area matches "legs" (leg, lower, quad, glute). */
function isLegsFocus(area: string | undefined): boolean {
  if (!area) return false;
  const lower = area.toLowerCase();
  return (
    lower.includes('leg') ||
    lower.includes('lower') ||
    lower.includes('quad') ||
    lower.includes('glute')
  );
}

/** Get total minutes for a month from weeklyVolume. Uses week Monday to determine month. */
function getMinutesForMonth(
  weeklyVolume: { weekKey: string; totalMinutes: number }[],
  year: number,
  month: number
): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return weeklyVolume
    .filter((w) => w.weekKey.startsWith(prefix))
    .reduce((sum, w) => sum + w.totalMinutes, 0);
}

/**
 * Generate rule-based insights from analytics and logs.
 */
export function generateInsights(
  analytics: TrainingLogAnalytics,
  logs: WorkoutLog[],
  goalMinutes: number
): TrainingLogInsight[] {
  const insights: TrainingLogInsight[] = [];

  // --- Volume drop: this month vs last month ---
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonthNum = now.getMonth() + 1;
  const lastMonthNum = thisMonthNum === 1 ? 12 : thisMonthNum - 1;
  const lastMonthYear = thisMonthNum === 1 ? thisYear - 1 : thisYear;

  const thisMonthMin = getMinutesForMonth(analytics.weeklyVolume, thisYear, thisMonthNum);
  const lastMonthMin = getMinutesForMonth(analytics.weeklyVolume, lastMonthYear, lastMonthNum);

  if (lastMonthMin > 0 && thisMonthMin < lastMonthMin * 0.6) {
    const pct = Math.round(((lastMonthMin - thisMonthMin) / lastMonthMin) * 100);
    insights.push({
      id: 'volume-drop',
      text: `Volume dropped ${pct}% vs. last month.`,
      category: 'volume',
      link: { label: 'See weekly trend', scrollTo: 'weekly-volume-chart' },
    });
  }

  // --- No legs in N days ---
  const LEGS_DAYS = 10;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LEGS_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentLogs = logs.filter((l) => l.date >= cutoffStr);
  const hasLegsRecently = recentLogs.some((l) => isLegsFocus(l.focusArea));

  if (!hasLegsRecently && recentLogs.length > 0) {
    insights.push({
      id: 'no-legs',
      text: `No legs in ${LEGS_DAYS} days.`,
      category: 'recency',
    });
  }

  // --- Type declining: e.g. Cardio down 3 weeks in a row ---
  const typeByWeek = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const weekMon = getWeekMonday(log.date);
    const type = deriveWorkoutType(log);
    const minutes = Math.round((log.durationSeconds ?? 0) / 60);
    if (!typeByWeek.has(weekMon)) {
      typeByWeek.set(weekMon, new Map());
    }
    const typeMap = typeByWeek.get(weekMon)!;
    typeMap.set(type, (typeMap.get(type) ?? 0) + minutes);
  }

  const weekKeys = Array.from(typeByWeek.keys()).sort().reverse();
  const DECLINE_WEEKS = 3;
  for (const type of ['Cardiovascular Fitness', 'Conditioning', 'Mobility']) {
    let consecutiveDeclines = 0;
    for (let i = 0; i < weekKeys.length - 1 && consecutiveDeclines < DECLINE_WEEKS; i++) {
      const curr = typeByWeek.get(weekKeys[i])?.get(type) ?? 0;
      const prev = typeByWeek.get(weekKeys[i + 1])?.get(type) ?? 0;
      if (curr < prev && prev > 0) {
        consecutiveDeclines++;
      } else {
        break;
      }
    }
    if (consecutiveDeclines >= DECLINE_WEEKS) {
      const typeLabel = type === 'Cardiovascular Fitness' ? 'Cardio' : type;
      insights.push({
        id: `type-decline-${type.toLowerCase().replace(/\s+/g, '-')}`,
        text: `${typeLabel} down ${DECLINE_WEEKS} weeks in a row.`,
        category: 'balance',
      });
      break; // Only one type-decline insight
    }
  }

  // --- Consistency: no goal hits in last 2 weeks ---
  if (analytics.weeklyVolume.length >= 2) {
    const lastTwo = analytics.weeklyVolume.slice(-2);
    const bothBelowGoal = lastTwo.every((w) => w.totalMinutes < goalMinutes);
    if (bothBelowGoal) {
      insights.push({
        id: 'consistency',
        text: 'No goal hits in the last 2 weeks.',
        category: 'consistency',
      });
    }
  }

  return insights;
}
