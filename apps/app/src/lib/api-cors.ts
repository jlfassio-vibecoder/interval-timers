/**
 * CORS headers for API routes called cross-origin by Universal Activity Hub.
 * When PUBLIC_UNIVERSAL_ACTIVITY_HUB_URL is set, the hub runs on a different origin
 * and must receive Access-Control-Allow-Origin for fetch to succeed.
 */

const HUB_ORIGIN =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env?.PUBLIC_UNIVERSAL_ACTIVITY_HUB_URL === 'string'
    ? (import.meta.env.PUBLIC_UNIVERSAL_ACTIVITY_HUB_URL as string).trim()
    : '';

/** Returns JSON + CORS headers for API responses. Use for GET/POST. */
export function getJsonResponseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (HUB_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = HUB_ORIGIN;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

/** Response for OPTIONS preflight when CORS is enabled. */
export function corsPreflightResponse(): Response | null {
  if (!HUB_ORIGIN) return null;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': HUB_ORIGIN,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
