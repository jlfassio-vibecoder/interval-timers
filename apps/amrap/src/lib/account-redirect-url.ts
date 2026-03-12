/**
 * Shared account redirect URL for AMRAP.
 * Matches AccountLink logic so AuthModal post-login redirect and AccountLink both
 * send users to the account page with ?from=amrap for the entry-point card.
 */

const hudRedirect = import.meta.env.VITE_HUD_REDIRECT_URL;
const hudIsWrong =
  typeof hudRedirect === 'string' &&
  (hudRedirect.includes('hud=1') || hudRedirect.includes('?hud='));

const ACCOUNT_BASE =
  import.meta.env.VITE_ACCOUNT_REDIRECT_URL ??
  (hudIsWrong ? undefined : hudRedirect) ??
  (import.meta.env.DEV ? 'http://localhost:3006/account' : '/account');

function withFromAmrap(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}from=amrap`;
}

/** Account URL with ?from=amrap for entry-point card on account page */
export const ACCOUNT_REDIRECT_URL = withFromAmrap(ACCOUNT_BASE);
