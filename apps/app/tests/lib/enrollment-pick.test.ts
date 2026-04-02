/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  pickActiveEnrollment,
  filterEnrollmentsByAssignedHint,
  type ActiveEnrollmentRow,
} from '@/lib/enrollment-pick';

function row(program_id: string, source: string, created_at: string | null): ActiveEnrollmentRow {
  return { program_id, source, created_at };
}

describe('pickActiveEnrollment', () => {
  it('returns preferred program when it exists in rows', () => {
    const rows = [
      row('a', 'self', '2025-01-01T00:00:00Z'),
      row('b', 'trainer_assigned', '2025-06-01T00:00:00Z'),
    ];
    expect(pickActiveEnrollment(rows, 'a')?.program_id).toBe('a');
  });

  it('prefers trainer_assigned over self when no preferred id', () => {
    const rows = [
      row('a', 'self', '2025-06-01T00:00:00Z'),
      row('b', 'trainer_assigned', '2025-01-01T00:00:00Z'),
    ];
    expect(pickActiveEnrollment(rows, null)?.program_id).toBe('b');
  });

  it('tie-breaks by newest created_at within same source', () => {
    const rows = [
      row('old', 'cohort', '2025-01-01T00:00:00Z'),
      row('new', 'cohort', '2025-06-01T00:00:00Z'),
    ];
    expect(pickActiveEnrollment(rows, null)?.program_id).toBe('new');
  });
});

describe('filterEnrollmentsByAssignedHint', () => {
  it('returns only hinted ids when some match', () => {
    const rows = [row('x', 'self', null), row('y', 'self', null)];
    const filtered = filterEnrollmentsByAssignedHint(rows, ['y']);
    expect(filtered.map((r) => r.program_id)).toEqual(['y']);
  });

  it('falls back to all rows when hint matches nothing', () => {
    const rows = [row('x', 'self', null)];
    expect(filterEnrollmentsByAssignedHint(rows, ['missing'])).toEqual(rows);
  });
});
