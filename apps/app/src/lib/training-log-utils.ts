/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilities for Training Log aggregation and display.
 */

import { toast } from 'sonner';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import type { WorkoutLog } from '@/types';

/**
 * Shows a warning toast when the user sets a weekly goal below the health guideline.
 * Call after a successful save. Never blocks the save.
 */
export function warnIfBelowGuideline(minutes: number): void {
  if (minutes >= HEALTH_GUIDELINE_WEEKLY_MINUTES) return;
  toast.warning(
    `Health organizations recommend ≥${HEALTH_GUIDELINE_WEEKLY_MINUTES} min/week moderate activity for general health. Lower targets are for gradual build-up — discuss with a professional if unsure.`
  );
}

/**
 * Sum duration_seconds for logs in the current week (Monday–Sunday, ISO week).
 * Aligned with Training Log analytics. Logs without durationSeconds contribute 0.
 */
export function getMinutesThisWeek(logs: WorkoutLog[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(now.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  let totalSeconds = 0;
  for (const log of logs) {
    const d = log.date ? new Date(log.date + 'T12:00:00') : null;
    if (!d || d < startOfWeek || d >= endOfWeek) continue;
    totalSeconds += log.durationSeconds ?? 0;
  }
  return totalSeconds / 60;
}
