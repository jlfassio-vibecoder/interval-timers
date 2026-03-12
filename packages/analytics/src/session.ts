/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Anonymous session ID for funnel attribution when user_id is not available.
 */

const STORAGE_KEY = 'it_analytics_session_id';

/**
 * Get or create a persistent session ID for anonymous event attribution.
 * Stored in localStorage; survives page reloads.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return '';
  }
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
