import { describe, it, expect } from 'vitest';
import { parseHandoffFromUrl } from './parseHandoffFromUrl';

describe('parseHandoffFromUrl', () => {
  it('parses valid URL with intent and source', () => {
    const result = parseHandoffFromUrl(
      'https://example.com/account?intent=save_session&source=tabata'
    );
    expect(result).toEqual({
      intent: 'save_session',
      source: 'tabata',
      from: 'tabata',
      timestamp: expect.any(Number),
    });
  });

  it('parses optional payload fields', () => {
    const result = parseHandoffFromUrl(
      'https://example.com/account?intent=save_session&source=tabata&time=900&calories=200&rounds=8&preset=standard'
    );
    expect(result?.intent).toBe('save_session');
    expect(result?.source).toBe('tabata');
    expect(result?.time).toBe('900');
    expect(result?.calories).toBe(200);
    expect(result?.rounds).toBe(8);
    expect(result?.preset).toBe('standard');
  });

  it('returns null when intent missing', () => {
    const result = parseHandoffFromUrl('https://example.com/account?source=tabata');
    expect(result).toBeNull();
  });

  it('returns null when source missing', () => {
    const result = parseHandoffFromUrl('https://example.com/account?intent=save_session');
    expect(result).toBeNull();
  });

  it('uses from as source fallback', () => {
    const result = parseHandoffFromUrl(
      'https://example.com/account?intent=save_session&from=amrap'
    );
    expect(result?.source).toBe('amrap');
    expect(result?.from).toBe('amrap');
  });

  it('returns null for malformed URL', () => {
    const result = parseHandoffFromUrl('not-a-valid-url');
    expect(result).toBeNull();
  });
});
