/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSV export for Training Log data.
 */

import type { WorkoutLog } from '@/types';
import {
  deriveWorkoutFormat,
  deriveWorkoutType,
} from '@/lib/supabase/client/training-log';
import { alignmentCompositeForLog } from '@/lib/fitness-goal-alignment';

/** Escape a CSV field: wrap in quotes if it contains comma, quote, or newline. */
function escapeCsvField(value: string | number | undefined | null): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Generate CSV string from workout logs. */
export function exportTrainingLogToCsv(logs: WorkoutLog[]): string {
  const headers = [
    'date',
    'duration_min',
    'workout_name',
    'workout_type',
    'workout_format',
    'effort',
    'rating',
    'notes',
    'intensity',
    'focus_area',
    'goal_snapshot',
    'goal_alignment_composite',
  ];
  const lines = [headers.join(',')];

  for (const log of logs) {
    const durationMin = log.durationSeconds != null ? Math.round(log.durationSeconds / 60) : '';
    const type = deriveWorkoutType(log);
    const format = deriveWorkoutFormat(log) ?? '';
    const goalSnapshot = log.goalSnapshot?.length ? log.goalSnapshot.join('|') : '';
    const goalAlignmentComposite = alignmentCompositeForLog(log) ?? '';
    const row = [
      escapeCsvField(log.date),
      escapeCsvField(durationMin),
      escapeCsvField(log.workoutName),
      escapeCsvField(type),
      escapeCsvField(format),
      escapeCsvField(log.effort),
      escapeCsvField(log.rating),
      escapeCsvField(log.notes),
      escapeCsvField(log.intensity),
      escapeCsvField(log.focusArea),
      escapeCsvField(goalSnapshot),
      escapeCsvField(goalAlignmentComposite),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
