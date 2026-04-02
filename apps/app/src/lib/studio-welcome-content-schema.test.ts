import { describe, expect, it } from 'vitest';
import {
  mergeStudioWelcomeContentPatch,
  parseStudioWelcomeContent,
  welcomeContentForPublicInvitePreview,
} from './studio-welcome-content-schema';

describe('parseStudioWelcomeContent', () => {
  it('returns empty object for non-objects', () => {
    expect(parseStudioWelcomeContent(null)).toEqual({});
    expect(parseStudioWelcomeContent([])).toEqual({});
  });

  it('normalizes locale blocks and drops unknown keys', () => {
    const out = parseStudioWelcomeContent({
      en: { heroTitle: '  Hi  ', junk: 'x' },
      emailSenderNote: 'note',
    });
    expect(out.en?.heroTitle).toBe('Hi');
    expect((out.en as Record<string, unknown>).junk).toBeUndefined();
    expect(out.emailSenderNote).toBe('note');
  });
});

describe('welcomeContentForPublicInvitePreview', () => {
  it('drops emailSenderNote only', () => {
    const out = welcomeContentForPublicInvitePreview(
      parseStudioWelcomeContent({
        emailSenderNote: 'internal',
        en: { heroTitle: 'Hi' },
      })
    );
    expect(out?.emailSenderNote).toBeUndefined();
    expect(out?.en?.heroTitle).toBe('Hi');
  });

  it('returns null when only internal note was set', () => {
    expect(
      welcomeContentForPublicInvitePreview(parseStudioWelcomeContent({ emailSenderNote: 'secret' }))
    ).toBeNull();
  });
});

describe('mergeStudioWelcomeContentPatch', () => {
  it('merges locale strings and clears on empty string', () => {
    const base = parseStudioWelcomeContent({
      en: { heroTitle: 'Old', heroSub: 'Sub' },
    });
    const merged = mergeStudioWelcomeContentPatch(base, {
      en: { heroTitle: 'New', heroSub: '' },
    });
    expect(merged.en?.heroTitle).toBe('New');
    expect(merged.en?.heroSub).toBeUndefined();
  });

  it('empty locale patch object leaves existing locale unchanged', () => {
    const base = parseStudioWelcomeContent({
      en: { heroTitle: 'A' },
      es: { heroTitle: 'B' },
    });
    const merged = mergeStudioWelcomeContentPatch(base, { en: {} });
    expect(merged.en?.heroTitle).toBe('A');
    expect(merged.es?.heroTitle).toBe('B');
  });
});
