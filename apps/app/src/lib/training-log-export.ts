/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSV export for Training Log data.
 */

import type { WorkoutLog } from '@/types';
import { deriveWorkoutFormat } from '@/lib/supabase/client/training-log';

function deriveWorkoutType(log: WorkoutLog): string {
  if (log.workoutType) return log.workoutType;
  const s = (log.source ?? '').toLowerCase();
  if (s.includes('program')) return 'Conditioning';
  if (s.includes('tabata') || s.includes('hiit')) return 'Cardiovascular Fitness';
  if (s.includes('amrap') || s.includes('emom') || s.includes('circuit')) return 'Conditioning';
  if (s.includes('warmup') || s.includes('warm-up')) return 'Mobility';
  return 'Other';
}

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
  ];
  const lines = [headers.join(',')];

  for (const log of logs) {
    const durationMin = log.durationSeconds != null ? Math.round(log.durationSeconds / 60) : '';
    const type = deriveWorkoutType(log);
    const format = deriveWorkoutFormat(log) ?? '';
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
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
