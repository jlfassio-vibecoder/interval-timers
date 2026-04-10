/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  SCHEDULED_LIVE_DEFAULT_CARD_TITLE,
  scheduledLiveCardTitle,
} from '@/lib/scheduled-live-card-title';

describe('scheduledLiveCardTitle', () => {
  it('uses default when displayName is null or missing', () => {
    expect(scheduledLiveCardTitle({ displayName: null })).toBe(SCHEDULED_LIVE_DEFAULT_CARD_TITLE);
    expect(scheduledLiveCardTitle({})).toBe(SCHEDULED_LIVE_DEFAULT_CARD_TITLE);
  });

  it('uses default when displayName is blank after trim', () => {
    expect(scheduledLiveCardTitle({ displayName: '   ' })).toBe(SCHEDULED_LIVE_DEFAULT_CARD_TITLE);
    expect(scheduledLiveCardTitle({ displayName: '' })).toBe(SCHEDULED_LIVE_DEFAULT_CARD_TITLE);
  });

  it('returns trimmed custom title', () => {
    expect(scheduledLiveCardTitle({ displayName: '  Team HIIT  ' })).toBe('Team HIIT');
    expect(scheduledLiveCardTitle({ displayName: 'Morning live' })).toBe('Morning live');
  });
});
