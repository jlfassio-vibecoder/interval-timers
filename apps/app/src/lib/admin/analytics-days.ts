/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared date-window options for admin analytics views (Analytics, Funnel, APP Analytics).
 * Query param: ?days=7|30|90
 */

export const ADMIN_ANALYTICS_DAY_OPTIONS = [7, 30, 90] as const;

export type AdminAnalyticsDays = (typeof ADMIN_ANALYTICS_DAY_OPTIONS)[number];

const DEFAULT_DAYS: AdminAnalyticsDays = 30;

const ALLOWED = new Set<number>(ADMIN_ANALYTICS_DAY_OPTIONS);

/**
 * Parse `days` from a URL search param. Only 7, 30, and 90 are valid; anything else falls back to default (30).
 */
export function parseAdminAnalyticsDays(value: string | null | undefined): AdminAnalyticsDays {
  if (value == null || value === '') return DEFAULT_DAYS;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || !ALLOWED.has(n)) return DEFAULT_DAYS;
  return n as AdminAnalyticsDays;
}
