/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { intervalsOverlap } from '@/lib/supabase/admin/trainer-client-calendar';

describe('intervalsOverlap (half-open [start, end) in ms)', () => {
  it('returns true when intervals overlap', () => {
    expect(intervalsOverlap(0, 60, 30, 90)).toBe(true);
  });

  it('returns false when adjacent (end equals other start)', () => {
    expect(intervalsOverlap(0, 60, 60, 120)).toBe(false);
  });

  it('returns false when disjoint', () => {
    expect(intervalsOverlap(0, 60, 100, 160)).toBe(false);
  });

  it('returns true when one interval contains the other', () => {
    expect(intervalsOverlap(0, 120, 40, 80)).toBe(true);
  });
});
