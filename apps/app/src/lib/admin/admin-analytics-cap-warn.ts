/**
 * Log when a capped admin analytics query returns exactly `limit` rows (possible truncation).
 */

export function warnIfAdminAnalyticsRowCapHit(
  context: string,
  rowCount: number,
  limit: number
): void {
  if (rowCount !== limit) return;
  const msg = `[admin-analytics-cap] ${context}: fetched ${rowCount} rows (limit ${limit}); aggregates may be truncated`;
  if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
    console.warn(msg);
  }
}
