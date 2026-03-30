/**
 * Merge studio welcome_content overrides with app defaults (pure; safe on client + server).
 */

import type { WelcomeHeroCopy, WelcomeHeroVariantId } from '@/lib/welcome-hero-variants';
import type { WelcomeLandingStrings, WelcomeLocale } from '@/lib/welcome-landing-strings';
import type {
  StudioWelcomeContentStored,
  StudioWelcomeLocaleBlock,
} from '@/types/studio-welcome-content';

function pickLocaleBlock(
  welcome: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale
): StudioWelcomeLocaleBlock | undefined {
  if (!welcome) return undefined;
  const direct = welcome[locale];
  if (direct && Object.keys(direct).length) return direct;
  if (locale !== 'en' && welcome.en && Object.keys(welcome.en).length) return welcome.en;
  return undefined;
}

export function pickWelcomeHeroOverrides(
  welcomeContent: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale
): { titleInvited?: string; subMissingToken?: string } {
  const b = pickLocaleBlock(welcomeContent, locale);
  if (!b) return {};
  return {
    titleInvited: b.heroTitle?.trim() || undefined,
    subMissingToken: b.heroSub?.trim() || undefined,
  };
}

export function mergeWelcomeHeroCopy(
  _variant: WelcomeHeroVariantId,
  _locale: WelcomeLocale,
  base: WelcomeHeroCopy,
  studioWelcome: StudioWelcomeContentStored | null | undefined
): WelcomeHeroCopy {
  const o = pickWelcomeHeroOverrides(studioWelcome, _locale);
  if (!o.titleInvited && !o.subMissingToken) return base;
  return {
    ...base,
    ...(o.titleInvited ? { titleInvited: o.titleInvited } : {}),
    ...(o.subMissingToken ? { subMissingToken: o.subMissingToken } : {}),
  };
}

/** Optional subline under hero when invite token is present (signed out, preview loaded). */
export function pickInviteFlowHeroSub(
  studioWelcome: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale
): string | null {
  const b = pickLocaleBlock(studioWelcome, locale);
  const s = b?.heroSub?.trim();
  return s || null;
}

/** Pre-sign-in status strip (signed out + token). */
export function mergeWelcomeStatusStrip(
  kind: 'friend' | 'client',
  strings: WelcomeLandingStrings,
  studioWelcome: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale
): string {
  const b = pickLocaleBlock(studioWelcome, locale);
  if (kind === 'client' && b?.clientStatusStrip?.trim()) return b.clientStatusStrip.trim();
  if (kind === 'friend' && b?.friendStatusStrip?.trim()) return b.friendStatusStrip.trim();
  return kind === 'client' ? strings.clientInviteStatusStrip : strings.signInEmailPhone;
}

export function mergeAcceptSuccessCopy(
  kind: 'friend' | 'client',
  strings: WelcomeLandingStrings,
  studioWelcome: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale
): string {
  const b = pickLocaleBlock(studioWelcome, locale);
  if (kind === 'friend' && b?.successFriend?.trim()) return b.successFriend.trim();
  if (kind === 'client' && b?.successClient?.trim()) return b.successClient.trim();
  return kind === 'friend' ? strings.acceptSuccessFriend : strings.acceptSuccessClient;
}

export function mergeOpenAppCta(
  strings: WelcomeLandingStrings,
  studioWelcome: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale
): string {
  const b = pickLocaleBlock(studioWelcome, locale);
  return b?.openAppCta?.trim() || strings.openApp;
}

/**
 * @returns Custom or default teaser with name; empty string means use `heroCopy.subCalendarTeaser`.
 */
export function mergeWelcomeBackTrainerTeaser(
  strings: WelcomeLandingStrings,
  studioWelcome: StudioWelcomeContentStored | null | undefined,
  locale: WelcomeLocale,
  trainerFirstName: string | null
): string {
  const b = pickLocaleBlock(studioWelcome, locale);
  const tpl = b?.trainerTeaserTemplate?.trim();
  if (tpl) {
    if (trainerFirstName) return tpl.replace(/\{name\}/g, trainerFirstName);
    const stripped = tpl
      .replace(/\{name\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped) return stripped;
  }
  if (trainerFirstName)
    return strings.welcomeLoggedInTrainerTeaser.replace('{name}', trainerFirstName);
  return '';
}
