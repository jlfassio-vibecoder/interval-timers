/**
 * Stable pseudonym for admin drill-through UIs (Phase P6 privacy precursor).
 * With ADMIN_ANALYTICS_PSEUDO_PEPPER set, uses HMAC-SHA256; otherwise SHA-256 (weaker, dev-only).
 */

import { createHash, createHmac } from 'node:crypto';

const SLICE_LEN = 20;

export function pseudonymizeAdminUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) return '';
  const pepper = process.env.ADMIN_ANALYTICS_PSEUDO_PEPPER?.trim();
  if (pepper) {
    return createHmac('sha256', pepper).update(trimmed).digest('hex').slice(0, SLICE_LEN);
  }
  return createHash('sha256').update(trimmed).digest('hex').slice(0, SLICE_LEN);
}
