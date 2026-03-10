/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin base path and URL helpers.
 * Override via PUBLIC_ADMIN_BASE_PATH for white-label or alternate paths.
 * Note: Changing the base path (e.g. to /cms) would require moving src/pages/admin/
 * to match; folder rename is a separate migration.
 */

function normalizeBasePath(raw: string | undefined): string {
  const fallback = '/admin';
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.includes('://') || trimmed.includes('?')) return fallback;
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  path = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  return path || fallback;
}

const rawBasePath =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: Record<string, string> }).env?.PUBLIC_ADMIN_BASE_PATH;

export const ADMIN_BASE_PATH = normalizeBasePath(
  typeof rawBasePath === 'string' ? rawBasePath : undefined
);

export const adminPaths = {
  root: ADMIN_BASE_PATH,
  login: `${ADMIN_BASE_PATH}/login`,
  home: '/',
} as const;
