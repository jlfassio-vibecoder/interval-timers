/**
 * Shared account redirect URL for AMRAP.
 * Matches AccountLink logic so AuthModal post-login redirect and AccountLink both
 * send users to the account page with ?from=amrap for the entry-point card.
 */

const hudRedirect = import.meta.env.VITE_HUD_REDIRECT_URL;
const hudIsWrong =
  typeof hudRedirect === 'string' &&
  (hudRedirect.includes('hud=1') || hudRedirect.includes('?hud='));

const ACCOUNT_BASE_INTERNAL =
  import.meta.env.VITE_ACCOUNT_REDIRECT_URL ??
  (hudIsWrong ? undefined : hudRedirect) ??
  (import.meta.env.DEV ? 'http://localhost:3006/account' : '/account');

function withFromAmrap(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}from=amrap`;
}

/** Account URL with ?from=amrap for entry-point card on account page */
export const ACCOUNT_REDIRECT_URL = withFromAmrap(ACCOUNT_BASE_INTERNAL);

/** Base URL for account page (no query); used by buildAccountRedirectUrl for handoff flows */
export const ACCOUNT_BASE = ACCOUNT_BASE_INTERNAL;

/** URL for HUD / View in History (fallback to account when VITE_HUD_REDIRECT_URL unset or wrong) */
export const HUD_REDIRECT_URL =
  (hudIsWrong ? undefined : hudRedirect) ??
  (import.meta.env.DEV ? 'http://localhost:3006/account' : '/account');

interface GuestClaimParams {
  sessionId?: string | null;
  participantId?: string | null;
  claimToken?: string | null;
}

/** Main app minimal onboarding URL for AMRAP handoff. */
export function buildMinimalOnboardingRedirectUrl(params?: GuestClaimParams): string {
  const onboardingBase = import.meta.env.DEV
    ? 'http://localhost:3006/account/onboarding/minimal'
    : '/account/onboarding/minimal';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const onboarding = new URL(onboardingBase, origin);
  onboarding.searchParams.set('from', 'amrap');
  onboarding.searchParams.set('return', HUD_REDIRECT_URL);
  if (params?.sessionId) onboarding.searchParams.set('guest_session', params.sessionId);
  if (params?.participantId) onboarding.searchParams.set('guest_participant', params.participantId);
  if (params?.claimToken) onboarding.searchParams.set('guest_claim', params.claimToken);
  return onboarding.toString();
}

export const MINIMAL_ONBOARDING_REDIRECT_URL = buildMinimalOnboardingRedirectUrl();
