/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { formatSetRepsDisplay, isPerSidePrescription } from '@/lib/tracking-per-side';
import type { SetLog } from '@/types/tracking';

describe('isPerSidePrescription', () => {
  it('detects /side in reps string', () => {
    expect(isPerSidePrescription('10/side', '')).toBe(true);
    expect(isPerSidePrescription('8 / side', '')).toBe(true);
  });

  it('detects per side in name or reps', () => {
    expect(isPerSidePrescription('10', 'Single-arm row per side')).toBe(true);
    expect(isPerSidePrescription('per side', '')).toBe(true);
  });

  it('returns false for typical bilateral barbell work', () => {
    expect(isPerSidePrescription('10', 'Barbell squat')).toBe(false);
    expect(isPerSidePrescription('8-10', 'Bench press')).toBe(false);
  });
});

describe('formatSetRepsDisplay', () => {
  const base: Pick<
    SetLog,
    'setNumber' | 'targetReps' | 'targetRPE' | 'actualWeight' | 'completed'
  > = {
    setNumber: 1,
    targetReps: '10',
    targetRPE: 0,
    actualWeight: 0,
    completed: false,
  };

  it('shows L and R when both are numbers', () => {
    expect(
      formatSetRepsDisplay({
        ...base,
        actualReps: 18,
        actualRepsLeft: 10,
        actualRepsRight: 8,
      })
    ).toBe('L10 R8');
  });

  it('falls back to total actualReps otherwise', () => {
    expect(formatSetRepsDisplay({ ...base, actualReps: 12 })).toBe('12');
    expect(formatSetRepsDisplay({ ...base, actualReps: 0 })).toBe('—');
  });
});
