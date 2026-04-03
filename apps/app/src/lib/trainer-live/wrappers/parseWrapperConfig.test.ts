import { describe, expect, it } from 'vitest';
import { parseAmrapSessionIdFromWrapperConfig } from './parseWrapperConfig';

describe('parseAmrapSessionIdFromWrapperConfig', () => {
  it('returns uuid from valid config', () => {
    expect(
      parseAmrapSessionIdFromWrapperConfig({
        amrap_session_id: '550e8400-e29b-41d4-a716-446655440000',
      })
    ).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns null for invalid uuid', () => {
    expect(parseAmrapSessionIdFromWrapperConfig({ amrap_session_id: 'not-a-uuid' })).toBeNull();
  });

  it('returns null for missing or wrong shape', () => {
    expect(parseAmrapSessionIdFromWrapperConfig(null)).toBeNull();
    expect(parseAmrapSessionIdFromWrapperConfig({})).toBeNull();
    expect(parseAmrapSessionIdFromWrapperConfig({ amrap_session_id: 1 })).toBeNull();
  });
});
