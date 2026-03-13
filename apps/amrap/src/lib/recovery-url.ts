/**
 * Builds the Recovery PWA URL for the desktop-to-phone flow.
 * Used when workout completes so user can scan QR to open recovery on phone.
 * Mirrors account-redirect-url.ts pattern for env + fallback.
 */

const recoveryBase =
  (import.meta.env.VITE_RECOVERY_PWA_URL as string | undefined)?.trim() ??
  (typeof window !== 'undefined'
    ? `${window.location.origin}/recovery/`
    : '/recovery/');

/**
 * Build recovery URL with optional sessionId and endTime.
 * @param sessionId - AMRAP session ID (null for solo)
 * @param endTime - Unix timestamp (ms) when workout ended
 */
export function buildRecoveryUrl(
  sessionId: string | null,
  endTime: number
): string {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  if (endTime > 0) params.set('endTime', String(endTime));
  const qs = params.toString();
  const base = recoveryBase.endsWith('/') ? recoveryBase : `${recoveryBase}/`;
  return qs ? `${base}?${qs}` : base;
}
