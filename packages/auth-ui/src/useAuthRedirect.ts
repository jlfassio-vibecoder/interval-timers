/**
 * Builds the redirect URL used after successful sign-in.
 * Appends ?from=<fromAppId> and optionally &returnUrl=<encoded returnUrl>
 * to the base URL, handling existing query params (? vs &).
 */
export function buildAuthRedirectUrl(
  redirectBaseUrl: string,
  options?: { fromAppId?: string; returnUrl?: string }
): string {
  const { fromAppId, returnUrl } = options ?? {};
  if (!fromAppId && !returnUrl) {
    return redirectBaseUrl;
  }

  const params = new URLSearchParams();
  if (fromAppId) params.set('from', fromAppId);
  if (returnUrl) params.set('returnUrl', returnUrl);
  const query = params.toString();
  if (!query) return redirectBaseUrl;

  const separator = redirectBaseUrl.includes('?') ? '&' : '?';
  return `${redirectBaseUrl}${separator}${query}`;
}
