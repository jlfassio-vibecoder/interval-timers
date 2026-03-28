import { describe, it, expect } from 'vitest';
import {
  normalizeInviteEmail,
  normalizeInvitePhoneE164,
  looksLikeRosterInviteToken,
} from '@/lib/supabase/admin/roster-invitations';

describe('roster invitation helpers', () => {
  it('normalizes email', () => {
    expect(normalizeInviteEmail('  Test@Example.COM ')).toBe('test@example.com');
  });

  it('validates E.164 phone', () => {
    expect(normalizeInvitePhoneE164('+15551234567')).toBe('+15551234567');
    expect(normalizeInvitePhoneE164('5551234567')).toBeNull();
    expect(normalizeInvitePhoneE164('+0123')).toBeNull();
  });

  it('token shape check', () => {
    expect(looksLikeRosterInviteToken('short')).toBe(false);
    expect(looksLikeRosterInviteToken('a'.repeat(32))).toBe(true);
  });
});
