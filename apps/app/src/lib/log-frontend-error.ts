/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side frontend error logger. Fire-and-forget POST to /api/log-frontend-error.
 */

import { getOrCreateSessionId } from '@interval-timers/analytics';

export interface LogFrontendErrorOptions {
  message: string;
  stack?: string;
  page?: string;
  user_id?: string | null;
  session_id?: string | null;
  properties?: Record<string, unknown>;
}

/**
 * Log a frontend error to the backend. Fire-and-forget; does not throw.
 */
export function logFrontendError(options: LogFrontendErrorOptions): void {
  const { message, stack, page, user_id, session_id, properties } = options;
  if (!message || typeof message !== 'string') return;

  const sessionId = session_id ?? (getOrCreateSessionId() || undefined);
  const payload = {
    message: message.slice(0, 2000),
    stack: stack != null ? String(stack).slice(0, 8000) : undefined,
    page:
      page != null
        ? String(page).slice(0, 500)
        : typeof window !== 'undefined'
          ? window.location.pathname
          : undefined,
    user_id: user_id ?? undefined,
    session_id: sessionId || undefined,
    properties:
      properties && typeof properties === 'object' && !Array.isArray(properties)
        ? properties
        : undefined,
  };

  try {
    fetch('/api/log-frontend-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // no-op
  }
}
