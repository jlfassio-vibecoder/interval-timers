/**
 * Magic-link (OTP) sessions: show credential upgrade until password or Google is linked.
 * Uses JWT `amr` (Authentication Methods References) + user_metadata flag.
 *
 * Product note: showing the gate on `/welcome?invite=` before invite accept may hurt conversion.
 * To defer, skip rendering the modal on that path until accept succeeds (e.g. sessionStorage flag).
 */

import type { Session, User } from '@supabase/supabase-js';

const GATE_META_KEY = 'credential_gate_completed';

/** Base64url-decode JWT payload segment. */
export function parseJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = globalThis.atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Latest authentication method from Supabase JWT `amr` claim. */
export function getLatestAmrMethod(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const amr = payload.amr;
  if (!Array.isArray(amr) || amr.length === 0) return null;
  const last = amr[amr.length - 1];
  if (typeof last === 'string') return last;
  if (last && typeof last === 'object' && last !== null && 'method' in last) {
    const m = (last as { method?: unknown }).method;
    if (typeof m === 'string') return m;
  }
  return null;
}

function isOtpLikeMethod(method: string): boolean {
  const lower = method.toLowerCase();
  return (
    lower === 'otp' ||
    lower === 'magiclink' ||
    lower === 'email_otp' ||
    lower === 'sms' ||
    lower === 'phone'
  );
}

/**
 * True when the signed-in user should see the blocking credential upgrade modal.
 * Fails open (false) when JWT/amr is missing or malformed so users are not locked out.
 */
export function shouldShowCredentialGate(session: Session | null, user: User | null): boolean {
  if (!session?.access_token || !user) return false;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta?.[GATE_META_KEY] === true) return false;

  const identities = user.identities ?? [];
  if (identities.some((i) => i.provider === 'google')) return false;

  const payload = parseJwtPayload(session.access_token);
  const method = getLatestAmrMethod(payload);
  if (!method) return false;

  const lower = method.toLowerCase();
  if (lower === 'password' || lower === 'oauth') return false;

  return isOtpLikeMethod(method);
}

export { GATE_META_KEY as CREDENTIAL_GATE_META_KEY };
