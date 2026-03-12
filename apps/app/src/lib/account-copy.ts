/**
 * Copy resolver for account page unauthenticated view.
 * Maps handoff intent + source to contextual headline/subtext per HUB_SPOKE_CONVERSION_ROADMAP Phase 2.
 */
import type { StoredHandoff } from '@interval-timers/handoff';

const HANDOFF_SUBTEXT =
  'Create your free profile to unlock your HUD and get unrestricted access to all 14 pro timers and lifestyle challenges.';

const FALLBACK_SUBTEXT = 'Log in or create an account to manage your apps and workouts.';

/**
 * Format time for insertion into copy (e.g. "Save your 15-minute Tabata session...").
 * @param time - "900" (seconds) or "15m" (min notation)
 * @returns "15-minute" or null if invalid
 */
export function formatTimeForCopy(time?: string): string | null {
  if (!time || typeof time !== 'string') return null;
  const trimmed = time.trim();
  if (!trimmed) return null;

  // "15m" or "15min" format
  const minMatch = trimmed.match(/^(\d+)m(in)?$/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1]!, 10);
    return Number.isFinite(mins) ? `${mins}-minute` : null;
  }

  // Numeric seconds
  const secs = parseInt(trimmed, 10);
  if (!Number.isFinite(secs) || secs < 0) return null;
  const mins = Math.round(secs / 60);
  return mins > 0 ? `${mins}-minute` : null;
}

export interface AccountCopyResult {
  headline: string;
  subtext: string;
  showLossAversion: boolean;
  primaryCtaIsSignUp: boolean;
}

/**
 * Resolve headline, subtext, and CTA config from handoff.
 * @param handoff - Stored handoff from sessionStorage or URL
 * @param fromAppId - Optional ?from= param when handoff is null (e.g. ?from=landing)
 */
export function getAccountCopy(
  handoff: StoredHandoff | null,
  fromAppId?: string | null
): AccountCopyResult {
  const intent = handoff?.intent;
  const source = handoff?.source ?? fromAppId ?? '';
  const timeFormatted = formatTimeForCopy(handoff?.time);

  if (!intent && source === 'landing') {
    return {
      headline: 'Sign in to unlock your profile.',
      subtext: HANDOFF_SUBTEXT,
      showLossAversion: false,
      primaryCtaIsSignUp: false,
    };
  }

  if (!intent || !handoff) {
    return {
      headline: 'Sign in to your account.',
      subtext: FALLBACK_SUBTEXT,
      showLossAversion: false,
      primaryCtaIsSignUp: false,
    };
  }

  if (intent === 'view_stats') {
    return {
      headline: 'View your stats and track your progress.',
      subtext: HANDOFF_SUBTEXT,
      showLossAversion: false,
      primaryCtaIsSignUp: false,
    };
  }

  if (intent === 'save_session') {
    let headline: string;
    switch (source) {
      case 'tabata':
        headline = timeFormatted
          ? `Incredible work. Save your ${timeFormatted} Tabata session to your permanent record.`
          : 'Incredible work. Save your Tabata session to your permanent record.';
        break;
      case 'amrap':
        headline = 'Well done. Log your AMRAP rounds and track your progress.';
        break;
      case 'daily-warmup':
        headline = timeFormatted
          ? `Nice work. Save your ${timeFormatted} Daily Warm-Up to your permanent record.`
          : 'Nice work. Save your Daily Warm-Up to your permanent record.';
        break;
      default:
        headline = timeFormatted
          ? `Save your ${timeFormatted} workout to your permanent record.`
          : 'Save your workout to your permanent record.';
    }

    return {
      headline,
      subtext: HANDOFF_SUBTEXT,
      showLossAversion: true,
      primaryCtaIsSignUp: true,
    };
  }

  return {
    headline: 'Sign in to your account.',
    subtext: FALLBACK_SUBTEXT,
    showLossAversion: false,
    primaryCtaIsSignUp: false,
  };
}
