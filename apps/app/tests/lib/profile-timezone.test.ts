/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getResolvedBrowserTimeZone, getSupportedIanaTimeZones } from '@/lib/profile-timezone';

describe('profile-timezone', () => {
  it('getResolvedBrowserTimeZone returns a non-empty string', () => {
    expect(getResolvedBrowserTimeZone().length).toBeGreaterThan(0);
  });

  it('getSupportedIanaTimeZones returns a sorted non-empty list', () => {
    const zones = getSupportedIanaTimeZones();
    expect(zones.length).toBeGreaterThan(0);
    const sorted = [...zones].sort((a, b) => a.localeCompare(b));
    expect(zones).toEqual(sorted);
    expect(zones.every((z) => typeof z === 'string' && z.length > 0)).toBe(true);
  });
});
