/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { shouldSuppressCoachConflictForSharedLiveSession } from '@/lib/supabase/admin/trainer-client-calendar';

describe('shouldSuppressCoachConflictForSharedLiveSession', () => {
  it('returns true when both ids match', () => {
    expect(
      shouldSuppressCoachConflictForSharedLiveSession(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440000'
      )
    ).toBe(true);
  });

  it('returns false when either is null', () => {
    expect(shouldSuppressCoachConflictForSharedLiveSession(null, 'x')).toBe(false);
    expect(shouldSuppressCoachConflictForSharedLiveSession('x', null)).toBe(false);
  });

  it('returns false when ids differ', () => {
    expect(
      shouldSuppressCoachConflictForSharedLiveSession(
        '550e8400-e29b-41d4-a716-446655440000',
        '650e8400-e29b-41d4-a716-446655440001'
      )
    ).toBe(false);
  });
});
