/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mirrors P0 SQL in trainer_live_schedule_invite_accept (capacity 6, waitlist ceil(20%)).
 */

import { describe, expect, it } from 'vitest';

const CLASS_CAPACITY = 6;
const WAITLIST_MAX = Math.ceil(0.2 * CLASS_CAPACITY);

function acceptOutcome(
  acceptedCount: number,
  waitlistedCount: number
): 'accepted' | 'waitlisted' | 'full' {
  if (acceptedCount < CLASS_CAPACITY) return 'accepted';
  if (waitlistedCount < WAITLIST_MAX) return 'waitlisted';
  return 'full';
}

describe('live schedule invite accept capacity (P0)', () => {
  it('uses capacity 6 and waitlist max 2', () => {
    expect(CLASS_CAPACITY).toBe(6);
    expect(WAITLIST_MAX).toBe(2);
  });

  it('accepts when under capacity', () => {
    for (let a = 0; a < 6; a++) {
      expect(acceptOutcome(a, 0)).toBe('accepted');
      expect(acceptOutcome(a, 2)).toBe('accepted');
    }
  });

  it('waitlists at capacity when waitlist has room', () => {
    expect(acceptOutcome(6, 0)).toBe('waitlisted');
    expect(acceptOutcome(6, 1)).toBe('waitlisted');
  });

  it('rejects when waitlist is full', () => {
    expect(acceptOutcome(6, 2)).toBe('full');
    expect(acceptOutcome(6, 99)).toBe('full');
  });
});
