import { describe, it, expect } from 'vitest';
import { nextVersionAfterMax } from '@/lib/supabase/admin/trainer-workouts-library';

describe('nextVersionAfterMax', () => {
  it('increments max when present', () => {
    expect(nextVersionAfterMax(3, 1)).toBe(4);
  });

  it('uses fallback+1 when max missing', () => {
    expect(nextVersionAfterMax(null, 2)).toBe(3);
    expect(nextVersionAfterMax(undefined, 5)).toBe(6);
  });
});
