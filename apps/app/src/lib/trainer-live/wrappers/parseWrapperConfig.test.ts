import { describe, expect, it } from 'vitest';
import {
  parseAmrapSessionIdFromWrapperConfig,
  parseEmomSessionIdFromWrapperConfig,
  parseTabataSessionIdFromWrapperConfig,
} from './parseWrapperConfig';

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

describe('parseTabataSessionIdFromWrapperConfig', () => {
  it('returns uuid from valid config', () => {
    expect(
      parseTabataSessionIdFromWrapperConfig({
        tabata_session_id: '550e8400-e29b-41d4-a716-446655440000',
      })
    ).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns null for invalid uuid', () => {
    expect(parseTabataSessionIdFromWrapperConfig({ tabata_session_id: 'not-a-uuid' })).toBeNull();
  });

  it('returns null for missing or wrong shape', () => {
    expect(parseTabataSessionIdFromWrapperConfig(null)).toBeNull();
    expect(parseTabataSessionIdFromWrapperConfig({})).toBeNull();
    expect(parseTabataSessionIdFromWrapperConfig({ tabata_session_id: 1 })).toBeNull();
  });
});

describe('parseEmomSessionIdFromWrapperConfig', () => {
  it('returns uuid from valid config', () => {
    expect(
      parseEmomSessionIdFromWrapperConfig({
        emom_session_id: '550e8400-e29b-41d4-a716-446655440000',
      })
    ).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns null for invalid uuid', () => {
    expect(parseEmomSessionIdFromWrapperConfig({ emom_session_id: 'not-a-uuid' })).toBeNull();
  });

  it('returns null for missing or wrong shape', () => {
    expect(parseEmomSessionIdFromWrapperConfig(null)).toBeNull();
    expect(parseEmomSessionIdFromWrapperConfig({})).toBeNull();
    expect(parseEmomSessionIdFromWrapperConfig({ emom_session_id: 1 })).toBeNull();
  });
});
