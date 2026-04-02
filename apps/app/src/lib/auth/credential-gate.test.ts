import { describe, expect, it } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import {
  CREDENTIAL_GATE_META_KEY,
  getLatestAmrMethod,
  parseJwtPayload,
  shouldShowCredentialGate,
} from './credential-gate';

function makeAccessToken(payload: Record<string, unknown>): string {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `e30.${p}.sig`;
}

function minimalSession(accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: '',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {} as User,
  };
}

function minimalUser(overrides: Partial<User> & { identities?: User['identities'] }): User {
  const testUserId = 'test-user-id';
  return {
    id: testUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'a@b.co',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe('parseJwtPayload', () => {
  it('returns null for malformed token', () => {
    expect(parseJwtPayload('')).toBeNull();
    expect(parseJwtPayload('a.b')).toBeNull();
    expect(parseJwtPayload('not-a-jwt')).toBeNull();
  });

  it('decodes payload segment', () => {
    const token = makeAccessToken({ sub: 'u1', amr: [{ method: 'otp', timestamp: 1 }] });
    const pl = parseJwtPayload(token);
    expect(pl?.sub).toBe('u1');
    expect(Array.isArray(pl?.amr)).toBe(true);
  });
});

describe('getLatestAmrMethod', () => {
  it('returns null for empty or missing amr', () => {
    expect(getLatestAmrMethod(null)).toBeNull();
    expect(getLatestAmrMethod({})).toBeNull();
    expect(getLatestAmrMethod({ amr: [] })).toBeNull();
  });

  it('reads object-shaped amr entries', () => {
    expect(getLatestAmrMethod({ amr: [{ method: 'password', timestamp: 1 }] })).toBe('password');
    expect(
      getLatestAmrMethod({
        amr: [
          { method: 'oauth', timestamp: 1 },
          { method: 'otp', timestamp: 2 },
        ],
      })
    ).toBe('otp');
  });

  it('reads string amr entries', () => {
    expect(getLatestAmrMethod({ amr: ['otp'] })).toBe('otp');
  });
});

describe('shouldShowCredentialGate', () => {
  it('is false without session or user', () => {
    expect(shouldShowCredentialGate(null, null)).toBe(false);
    expect(shouldShowCredentialGate(null, minimalUser({}))).toBe(false);
  });

  it('is false when credential_gate_completed is true', () => {
    const token = makeAccessToken({ amr: [{ method: 'otp', timestamp: 1 }] });
    const session = minimalSession(token);
    const user = minimalUser({
      user_metadata: { [CREDENTIAL_GATE_META_KEY]: true },
    });
    expect(shouldShowCredentialGate(session, user)).toBe(false);
  });

  it('is false when Google identity exists', () => {
    const token = makeAccessToken({ amr: [{ method: 'otp', timestamp: 1 }] });
    const session = minimalSession(token);
    const u = minimalUser({
      identities: [
        {
          provider: 'google',
          id: 'g',
          user_id: 'test-user-id',
          identity_id: 'i',
          created_at: '',
          updated_at: '',
        },
      ],
    });
    expect(shouldShowCredentialGate(session, u)).toBe(false);
  });

  it('is false for password oauth amr', () => {
    const session = minimalSession(
      makeAccessToken({ amr: [{ method: 'password', timestamp: 1 }] })
    );
    expect(shouldShowCredentialGate(session, minimalUser({}))).toBe(false);
    const sessionOauth = minimalSession(
      makeAccessToken({ amr: [{ method: 'oauth', timestamp: 1 }] })
    );
    expect(shouldShowCredentialGate(sessionOauth, minimalUser({}))).toBe(false);
  });

  it('is false when amr missing (fail open)', () => {
    const session = minimalSession(makeAccessToken({ sub: 'x' }));
    expect(shouldShowCredentialGate(session, minimalUser({}))).toBe(false);
  });

  it('is true for otp magic-link style amr without google and without completion flag', () => {
    const token = makeAccessToken({ amr: [{ method: 'otp', timestamp: 1 }] });
    const session = minimalSession(token);
    expect(shouldShowCredentialGate(session, minimalUser({ identities: [] }))).toBe(true);
  });
});
