import { describe, it, expect } from 'vitest';
import { buildAccountRedirectUrl } from './buildAccountRedirectUrl';

describe('buildAccountRedirectUrl', () => {
  it('includes intent and source', () => {
    const url = buildAccountRedirectUrl('save_session', 'tabata');
    expect(url).toContain('intent=save_session');
    expect(url).toContain('source=tabata');
    expect(url).toContain('from=tabata');
  });

  it('defaults baseUrl to /account', () => {
    const url = buildAccountRedirectUrl('save_session', 'tabata');
    expect(url).toMatch(/^\/account\?/);
  });

  it('uses custom baseUrl', () => {
    const url = buildAccountRedirectUrl(
      'save_session',
      'tabata',
      undefined,
      'http://localhost:3006/account'
    );
    expect(url).toMatch(/^http:\/\/localhost:3006\/account\?/);
    expect(url).toContain('intent=save_session');
  });

  it('appends optional payload fields', () => {
    const url = buildAccountRedirectUrl('save_session', 'tabata', {
      time: '900',
      calories: 200,
      rounds: 8,
      preset: 'standard',
    });
    expect(url).toContain('time=900');
    expect(url).toContain('calories=200');
    expect(url).toContain('rounds=8');
    expect(url).toContain('preset=standard');
  });

  it('handles baseUrl with existing query', () => {
    const url = buildAccountRedirectUrl(
      'save_session',
      'amrap',
      { time: '600' },
      '/account?foo=bar'
    );
    expect(url).toContain('/account?foo=bar&');
    expect(url).toContain('intent=save_session');
    expect(url).toContain('time=600');
  });
});
