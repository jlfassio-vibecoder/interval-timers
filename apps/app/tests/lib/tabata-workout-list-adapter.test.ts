/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isValidTabataAttachInput,
  workoutRowToTabataAttachParams,
} from '@/lib/trainer-live/tabata-workout-list-adapter';

describe('isValidTabataAttachInput', () => {
  it('accepts 1–32 rounds and at least one exercise', () => {
    expect(isValidTabataAttachInput(8, ['A'])).toBe(true);
    expect(isValidTabataAttachInput(1, ['A', 'B'])).toBe(true);
    expect(isValidTabataAttachInput(32, ['A'])).toBe(true);
  });

  it('rejects invalid round count or empty list', () => {
    expect(isValidTabataAttachInput(0, ['A'])).toBe(false);
    expect(isValidTabataAttachInput(33, ['A'])).toBe(false);
    expect(isValidTabataAttachInput(8, [])).toBe(false);
    expect(isValidTabataAttachInput(8, ['  ', ''])).toBe(false);
  });
});

describe('workoutRowToTabataAttachParams', () => {
  it('uses round count from row when valid', () => {
    const r = workoutRowToTabataAttachParams({
      blocks: [{ type: 'main', name: 'M', order: 1, exercises: [{ name: 'A' }] }],
      roundCount: 12,
    });
    expect(r.workoutList).toEqual(['A']);
    expect(r.roundCount).toBe(12);
  });

  it('defaults round count when missing or out of range', () => {
    const r = workoutRowToTabataAttachParams({
      blocks: [{ type: 'main', name: 'M', order: 1, exercises: [{ name: 'A' }] }],
      roundCount: null,
    });
    expect(r.roundCount).toBe(8);
  });

  it('throws when no exercises', () => {
    expect(() =>
      workoutRowToTabataAttachParams({
        blocks: [{ type: 'main', name: 'M', order: 1, exercises: [] }],
        roundCount: 8,
      })
    ).toThrow(/no exercises/);
  });
});
