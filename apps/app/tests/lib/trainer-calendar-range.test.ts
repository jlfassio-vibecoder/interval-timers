/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_CALENDAR_RANGE_DAYS,
  parseISODateOnly,
  validateCalendarRange,
} from '@/lib/supabase/admin/trainer-client-calendar';

describe('trainer-client-calendar range validation', () => {
  it('parseISODateOnly accepts YYYY-MM-DD only', () => {
    expect(parseISODateOnly('2026-04-01')).toBe(true);
    expect(parseISODateOnly('2026-4-01')).toBe(false);
    expect(parseISODateOnly('04-01-2026')).toBe(false);
    expect(parseISODateOnly('')).toBe(false);
  });

  it('validateCalendarRange rejects invalid order', () => {
    const r = validateCalendarRange('2026-04-10', '2026-04-01');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('<=');
  });

  it('validateCalendarRange accepts valid span within cap', () => {
    const r = validateCalendarRange('2026-01-01', '2026-03-04');
    expect(r.ok).toBe(true);
  });

  it('validateCalendarRange rejects ranges over cap', () => {
    const r = validateCalendarRange('2026-01-01', '2026-04-15');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(MAX_CALENDAR_RANGE_DAYS));
  });
});
